import { useState, useRef } from 'react'
import Papa from 'papaparse'
import axios from 'axios'
import { Play, Upload, Download, FileJson, Table2, Settings2, Code2 } from 'lucide-react'

// Adjust backend URL if deployed
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL !== undefined ? import.meta.env.VITE_BACKEND_URL : 'http://localhost:8000'

function App() {
  const [method, setMethod] = useState('GET')
  const [url, setUrl] = useState('https://jsonplaceholder.typicode.com/users/{{id}}')
  const [headersStr, setHeadersStr] = useState('{\n  "Content-Type": "application/json"\n}')
  const [bodyStr, setBodyStr] = useState('{\n  "name": "{{name}}"\n}')
  
  const [activeTab, setActiveTab] = useState('headers') // headers, body, csv
  
  // CSV State
  const [csvFile, setCsvFile] = useState(null)
  const [csvRows, setCsvRows] = useState([])
  const [csvHeaders, setCsvHeaders] = useState([])
  
  // Execution State
  const [concurrency, setConcurrency] = useState(1)
  const [rateLimit, setRateLimit] = useState(0) // ms
  
  // Results State
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [summary, setSummary] = useState(null)

  const fileInputRef = useRef(null)

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setCsvFile(file)
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setCsvHeaders(results.meta.fields || [])
          setCsvRows(results.data)
        }
      })
    }
  }

  const handleRunBatch = async () => {
    if (csvRows.length === 0) {
      alert("Please upload a CSV file with data rows first.")
      return
    }

    setLoading(true)
    setResults(null)
    setSummary(null)

    let parsedHeaders = {}
    let parsedBody = null

    try {
      if (headersStr.trim()) parsedHeaders = JSON.parse(headersStr)
      if (bodyStr.trim() && method !== 'GET' && method !== 'DELETE') parsedBody = JSON.parse(bodyStr)
    } catch (e) {
      alert("Invalid JSON in Headers or Body")
      setLoading(false)
      return
    }

    const payload = {
      config: {
        method,
        url,
        headers: parsedHeaders,
        body: parsedBody
      },
      rows: csvRows,
      concurrency_limit: parseInt(concurrency, 10),
      rate_limit_ms: parseInt(rateLimit, 10)
    }

    try {
      const response = await axios.post(`${BACKEND_URL}/api/execute/batch`, payload)
      setResults(response.data.results)
      setSummary(response.data.summary)
    } catch (error) {
      console.error(error)
      alert("Error executing batch. Is backend running?")
    } finally {
      setLoading(false)
    }
  }

  const downloadReport = () => {
    if (!results) return

    // Flatten results to export as CSV
    const reportData = results.map(r => {
      // Create base object matching original row
      const originalRow = csvRows[r.row_index] || {}
      return {
        ...originalRow,
        _Run_Status: r.success ? 'SUCCESS' : 'FAILED',
        _Status_Code: r.status_code,
        _Duration_ms: r.duration_ms,
        _Error: r.error || '',
        _Response_Snippet: JSON.stringify(r.response).substring(0, 100) // snippet
      }
    })

    const csv = Papa.unparse(reportData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", "api_run_report.csv")
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <Code2 color="var(--md-sys-color-primary)" size={28} />
        <h1>API Runner Pro</h1>
      </header>

      <main className="app-main">
        {/* LEFT PANEL: CONFIGURATION */}
        <section className="left-panel">
          
          <div className="md-card flex-col">
            <h2 style={{fontSize: '16px', marginBottom: '8px'}}>Request Configuration</h2>
            <div className="flex-row" style={{alignItems: 'flex-end'}}>
              <div style={{flex: '0 0 120px'}}>
                <label className="stat-label">Method</label>
                <select className="method-select" style={{width: '100%'}} value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <div style={{flex: 1}}>
                <label className="stat-label">URL (Use {'{{Var}}'} for variables)</label>
                <input 
                  type="text" 
                  className="md-input" 
                  placeholder="https://api.example.com/v1/users/{{id}}"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="md-card flex-col" style={{flex: 1}}>
            <div className="md-tabs">
              <div className={`md-tab ${activeTab === 'headers' ? 'active' : ''}`} onClick={() => setActiveTab('headers')}>Headers</div>
              <div className={`md-tab ${activeTab === 'body' ? 'active' : ''}`} onClick={() => setActiveTab('body')}>Body</div>
              <div className={`md-tab ${activeTab === 'csv' ? 'active' : ''}`} onClick={() => setActiveTab('csv')}>CSV Runner</div>
            </div>

            <div style={{flex: 1, overflowY: 'auto', paddingTop: '16px'}}>
              {activeTab === 'headers' && (
                <div className="flex-col" style={{height: '100%'}}>
                  <p className="stat-label">Headers (JSON format)</p>
                  <textarea 
                    className="md-input md-textarea" 
                    style={{flex: 1}}
                    value={headersStr}
                    onChange={(e) => setHeadersStr(e.target.value)}
                  />
                </div>
              )}
              
              {activeTab === 'body' && (
                <div className="flex-col" style={{height: '100%'}}>
                  <p className="stat-label">Request Body (JSON format)</p>
                  <textarea 
                    className="md-input md-textarea" 
                    style={{flex: 1}}
                    value={bodyStr}
                    onChange={(e) => setBodyStr(e.target.value)}
                    disabled={method === 'GET' || method === 'DELETE'}
                  />
                </div>
              )}

              {activeTab === 'csv' && (
                <div className="flex-col">
                  <div className="file-upload-zone" onClick={() => fileInputRef.current?.click()}>
                    <input 
                      type="file" 
                      accept=".csv" 
                      style={{display: 'none'}} 
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                    />
                    <Upload size={32} color="var(--md-sys-color-primary)" />
                    <p>{csvFile ? csvFile.name : "Click to Upload CSV"}</p>
                    {csvRows.length > 0 && (
                      <p style={{fontSize: '12px', color: 'var(--md-sys-color-success)'}}>Loaded {csvRows.length} rows</p>
                    )}
                  </div>

                  {csvHeaders.length > 0 && (
                    <div style={{marginTop: '16px'}}>
                      <p className="stat-label">Available Variables:</p>
                      <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px'}}>
                        {csvHeaders.map(h => (
                          <span key={h} className="status-badge" style={{backgroundColor: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)'}}>
                            {`{{${h}}}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex-row" style={{marginTop: '24px'}}>
                    <div style={{flex: 1}}>
                      <label className="stat-label">Concurrency Limit</label>
                      <input 
                        type="number" 
                        className="md-input" 
                        min="1" max="100"
                        value={concurrency}
                        onChange={(e) => setConcurrency(e.target.value)}
                      />
                    </div>
                    <div style={{flex: 1}}>
                      <label className="stat-label">Rate Limit (ms delay)</label>
                      <input 
                        type="number" 
                        className="md-input" 
                        min="0" step="100"
                        value={rateLimit}
                        onChange={(e) => setRateLimit(e.target.value)}
                      />
                    </div>
                  </div>

                  <button 
                    className="md-button" 
                    style={{marginTop: '24px', justifyContent: 'center', padding: '16px'}}
                    onClick={handleRunBatch}
                    disabled={loading || csvRows.length === 0}
                  >
                    <Play size={20} />
                    {loading ? "Running Batch..." : `Run Batch (${csvRows.length} requests)`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT PANEL: RESULTS */}
        <section className="right-panel">
          <div className="md-card flex-col" style={{flex: 1, display: 'flex'}}>
            <h2 style={{fontSize: '16px', marginBottom: '8px'}}>Execution Results</h2>
            
            {!summary && !loading && (
              <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--md-sys-color-outline)'}}>
                <div style={{textAlign: 'center'}}>
                  <Table2 size={48} style={{opacity: 0.5, marginBottom: '16px'}} />
                  <p>Run a batch to see results here</p>
                </div>
              </div>
            )}

            {loading && (
              <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--md-sys-color-primary)'}}>
                <div style={{textAlign: 'center'}}>
                  <Settings2 className="spin" size={48} style={{opacity: 0.8, marginBottom: '16px', animation: 'spin 2s linear infinite'}} />
                  <p>Executing requests...</p>
                  <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                </div>
              </div>
            )}

            {summary && (
              <>
                <div className="summary-card">
                  <div className="summary-stats">
                    <div className="stat-item">
                      <span className="stat-label">Total Requests</span>
                      <span className="stat-value">{summary.total}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Success</span>
                      <span className="stat-value" style={{color: 'var(--md-sys-color-success)'}}>{summary.success}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Failed</span>
                      <span className="stat-value" style={{color: 'var(--md-sys-color-error)'}}>{summary.failed}</span>
                    </div>
                  </div>
                  <button className="md-button outlined" onClick={downloadReport}>
                    <Download size={18} /> Download Report
                  </button>
                </div>

                <div className="md-table-container" style={{flex: 1, marginTop: '16px'}}>
                  <table className="md-table">
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Status</th>
                        <th>Code</th>
                        <th>Time</th>
                        <th>URL Preview</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results?.map((r, i) => (
                        <tr key={i}>
                          <td>{r.row_index + 1}</td>
                          <td>
                            <span className={`status-badge ${r.success ? 'success' : 'error'}`}>
                              {r.success ? 'OK' : 'FAIL'}
                            </span>
                          </td>
                          <td>{r.status_code || '-'}</td>
                          <td>{r.duration_ms}ms</td>
                          <td style={{maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                            {r.url}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
