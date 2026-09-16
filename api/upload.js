import { handleUpload } from '@vercel/blob/client'

function blobCredentials() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  const oidcToken = process.env.VERCEL_OIDC_TOKEN?.trim()
  const storeId = process.env.BLOB_STORE_ID?.trim()

  if (token) return { token }
  if (oidcToken && storeId) return { oidcToken, storeId }

  throw new Error('Vercel Blob is not configured. Add BLOB_READ_WRITE_TOKEN, or configure Vercel OIDC with BLOB_STORE_ID.')
}

export default async function handler(request, response) {
  try {
    const body = await request.json()
    const credentials = blobCredentials()

    const jsonResponse = await handleUpload({
      body,
      request,
      ...credentials,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        let payload = {}
        try { payload = JSON.parse(clientPayload || '{}') } catch {}

        const configured = (process.env.ADMIN_UPLOAD_KEY || '').trim()
        const supplied = (payload.adminKey || '').trim()
        if (!configured || !supplied || configured !== supplied) {
          throw new Error('Unauthorized')
        }

        return {
          allowedContentTypes: ['application/vnd.android.package-archive', 'application/octet-stream'],
          access: 'private',
          addRandomSuffix: true,
          maximumSizeInBytes: 1024 * 1024 * 1024,
        }
      },
      onUploadCompleted: async () => {},
    })

    return response.status(200).json(jsonResponse)
  } catch (error) {
    console.error('Blob upload token error:', error)
    return response.status(400).json({ error: error?.message || 'Upload failed' })
  }
}
