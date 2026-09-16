import { handleUpload } from '@vercel/blob/client'

export default async function handler(request, response) {
  try {
    const body = await request.json()

    const jsonResponse = await handleUpload({
      body,
      request,
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
    return response.status(400).json({ error: error.message || 'Upload failed' })
  }
}
