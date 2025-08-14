import React from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

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
  // Flatten the runs data for the grid
  const rowData = runData.runs.flat().map((step, index) => ({
    id: index,
    name: step.name,
    start: new Date(step.start).toLocaleString(),
    end: new Date(step.end).toLocaleString(),
    duration: `${(step.duration_ms / 1000).toFixed(2)}s`,
    duration_ms: step.duration_ms
  }));

  const columnDefs: ColDef[] = [
    { field: 'name', headerName: 'Step Name', flex: 1 },
    { field: 'start', headerName: 'Start Time', flex: 1 },
    { field: 'end', headerName: 'End Time', flex: 1 },
    { field: 'duration', headerName: 'Duration', flex: 1 }
  ];

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
      <div className="ag-theme-alpine" style={{ height: 400, width: '100%' }}>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: true,
            resizable: true,
          }}
        />
      </div>
    </div>
  );
};

export default RunsTable;