const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyaEY8PdmGmAVRrTIZJSz1YWcuvti_CfGpQfyQsPj3eli9Gq7cNh62zqzAO1gg1NNmDgA/exec'

module.exports = async function handler(req, res) {
  const params = new URLSearchParams({ action: 'save', ...req.query })
  const url = `${SCRIPT_URL}?${params}`
  const response = await fetch(url)
  const text = await response.text()
  try {
    const data = JSON.parse(text)
    res.status(200).json(data)
  } catch (e) {
    res.status(200).json({ ok: false, error: `Apps Script returned: ${text.slice(0, 200)}` })
  }
}
