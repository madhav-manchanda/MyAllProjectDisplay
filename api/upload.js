import { handleUpload } from '@vercel/blob/client'

export default async function handler(request, response) {
  const body = await request.json()

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        let payload = {}
        try { payload = JSON.parse(clientPayload || '{}') } catch {}

        if (!process.env.ADMIN_UPLOAD_KEY || payload.adminKey !== process.env.ADMIN_UPLOAD_KEY) {
          throw new Error('Unauthorized')
        }

        return {
          allowedContentTypes: ['application/vnd.android.package-archive', 'application/octet-stream'],
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
