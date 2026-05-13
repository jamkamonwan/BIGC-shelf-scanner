const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyaEY8PdmGmAVRrTIZJSz1YWcuvti_CfGpQfyQsPj3eli9Gq7cNh62zqzAO1gg1NNmDgA/exec'

export default async function handler(req, res) {
  const params = new URLSearchParams({ action: 'save', ...req.query })
  const response = await fetch(`${SCRIPT_URL}?${params}`)
  const data = await response.json()
  res.status(200).json(data)
}
