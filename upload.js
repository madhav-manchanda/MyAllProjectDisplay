import { handleUpload } from '@vercel/blob/client'

// Root cause of the unreliable upload/download behaviour: the previous version of
// this file hand-rolled a token flow on top of `issueSignedToken` + `presignUrl`.
// Those are low-level, undocumented-in-the-README primitives meant for advanced
// delegation scenarios. Composing them manually (build a token, presign a PUT,
// have the browser XHR the raw file to it, then "verify" by presigning a GET and
// checking the pathname string) never actually confirms Vercel Blob received the
// object — it only confirms the *request* didn't error. That's why uploads could
// "succeed" in the UI without a durable object ever landing in the store.
//
// `@vercel/blob/client`'s `handleUpload` is the officially supported, documented
// client-upload protocol (see the @vercel/blob README/docs). The browser's
// `upload()` call only resolves with a `PutBlobResult` after Vercel Blob has
// actually accepted and stored the object, and `onUploadCompleted` below is
// invoked server-to-server by Vercel itself (not by the browser) once the blob
// is durably written — a real completion signal, not a client's say-so.

const FILE_RULES = {
  APK: { extensions: ['.apk'], contentTypes: ['application/vnd.android.package-archive', 'application/octet-stream'] },
  EXE: { extensions: ['.exe'], contentTypes: ['application/vnd.microsoft.portable-executable', 'application/x-msdownload', 'application/octet-stream'] },
  Extension: { extensions: ['.zip', '.crx', '.xpi'], contentTypes: ['application/zip', 'application/x-zip-compressed', 'application/x-chrome-extension', 'application/x-xpinstall', 'application/octet-stream'] },
}
const MAX_SIZE = 1024 * 1024 * 1024 // 1 GB

function getRule(pathname) {
  const lower = pathname.toLowerCase()
  return Object.values(FILE_RULES).find((rule) => rule.extensions.some((ext) => lower.endsWith(ext)))
}

function log(event, data) {
  // Diagnostics only — never log tokens/keys, and only ever log pathnames, not full signed URLs.
  console.log(`[upload] ${event}`, data ? JSON.stringify(data) : '')
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })

  const configuredKey = (process.env.ADMIN_UPLOAD_KEY || '').trim()
  if (!configuredKey) {
    console.error('[upload] ADMIN_UPLOAD_KEY is not configured for this deployment.')
    return response.status(500).json({ error: 'Server is missing required configuration.', code: 'MISSING_ADMIN_KEY_CONFIG' })
  }
  if (!(process.env.BLOB_READ_WRITE_TOKEN || '').trim()) {
    console.error('[upload] BLOB_READ_WRITE_TOKEN is not configured for this deployment.')
    return response.status(500).json({ error: 'Server is missing required configuration.', code: 'MISSING_BLOB_TOKEN_CONFIG' })
  }

  try {
    const body = request.body
    const suppliedKey = String(request.headers['x-admin-key'] || '').trim()

    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!configuredKey || suppliedKey !== configuredKey) {
          log('rejected: bad admin key', { pathname })
          throw new Error('Unauthorized')
        }
        if (!pathname.startsWith('files/')) {
          log('rejected: bad pathname', { pathname })
          throw new Error('Invalid file path.')
        }
        const rule = getRule(pathname)
        if (!rule) {
          log('rejected: unsupported extension', { pathname })
          throw new Error('Unsupported file. Use APK, EXE, or ZIP/CRX/XPI browser extension files.')
        }

        log('token requested', { pathname })
        return {
          allowedContentTypes: rule.contentTypes,
          maximumSizeInBytes: MAX_SIZE,
          addRandomSuffix: false,
          allowOverwrite: true,
          tokenPayload: JSON.stringify({ pathname }),
        }
      },
      onUploadCompleted: async ({ blob }) => {
        // Fired by Vercel's servers once the object is confirmed durably stored —
        // this is real, server-verified confirmation, unlike the old fake "verify" step.
        log('upload completed (Blob-confirmed)', { pathname: blob.pathname, contentType: blob.contentType })
      },
    })

    return response.status(200).json(result)
  } catch (error) {
    console.error('[upload] error:', error?.message || error)
    const message = error?.message === 'Unauthorized' ? 'Unauthorized' : (error?.message || 'Could not process upload')
    const status = message === 'Unauthorized' ? 401 : 400
    return response.status(status).json({ error: message, code: status === 401 ? 'UNAUTHORIZED' : 'UPLOAD_REJECTED' })
  }
}
