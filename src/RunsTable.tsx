import React from 'react';

interface RunStep {
  name: string;
  start: string;
  end: string;
  duration_ms: number;
}

interface RunData {
  success: boolean;
  err_string?: string;
  start: string;
  end: string;
  duration_ms: number;
  runs: RunStep[][];
}

interface RunsTableProps {
  runData: RunData;
}

const RunsTable: React.FC<RunsTableProps> = ({ runData }) => {
  // Flatten the runs data for the table
  const tableData = runData.runs.flat().map((step, index) => ({
    id: index,
    name: step.name,
    start: new Date(step.start).toLocaleString(),
    end: new Date(step.end).toLocaleString(),
    duration: `${(step.duration_ms / 1000).toFixed(2)}s`,
    duration_ms: step.duration_ms
  }));

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (ms: number) => {
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="runs-table-container">
      <h2>Run Details</h2>

      {/* Summary Information */}
      <div className="run-summary">
        <div className={`status ${runData.success ? 'success' : 'error'}`}>
          <strong>Status:</strong> {runData.success ? 'Success' : 'Failed'}
        </div>
        {runData.err_string && (
          <div className="error-message">
            <strong>Error:</strong> {runData.err_string}
          </div>
        )}
        <div className="timing-info">
          <span><strong>Start:</strong> {formatDate(runData.start)}</span>
          <span><strong>End:</strong> {formatDate(runData.end)}</span>
          <span><strong>Total Duration:</strong> {formatDuration(runData.duration_ms)}</span>
        </div>
      </div>

      {/* Steps Table */}
      <div className="table-container" style={{ marginTop: '20px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Step Name</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Start Time</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>End Time</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Duration</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row) => (
              <tr key={row.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>{row.name}</td>
                <td style={{ padding: '10px' }}>{row.start}</td>
                <td style={{ padding: '10px' }}>{row.end}</td>
                <td style={{ padding: '10px' }}>{row.duration}</td>
              </tr>
            ))}
            {tableData.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RunsTable;