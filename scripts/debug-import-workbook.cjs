const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

(async () => {
  const workbook = new ExcelJS.Workbook();

  const summarySheet = workbook.addWorksheet('Trips_Summary');
  summarySheet.addRow(['', '', '', '', '', '', '']);
  summarySheet.addRow(['Ride_ID', 'Driver_ID', 'Total_Pers', 'Trip_Dist', 'NumberOfTrips', 'Max Load', 'NumberOfStops', 'First Stop', 'Last Stop', 'Departure', 'Arrival']);
  summarySheet.addRow([101, 42, 4, 12.5, 1, 4, 3, 'A', 'B', '08:00', '09:30']);

  const detailsSheet = workbook.addWorksheet('Trips_Details');
  detailsSheet.addRow(['Ride_ID', 'Trip_ID', 'Driver_ID', 'Board_Stop', 'Alight_Stop', 'Departure', 'Arrival', 'Seat', 'Stops']);
  detailsSheet.addRow([101, 202, 42, 'A', 'B', '08:00', '09:30', '1', '2']);

  const stopsSheet = workbook.addWorksheet('Stops');
  stopsSheet.addRow(['Stop Name', 'Lat', 'Lng', 'Address']);
  stopsSheet.addRow(['A', 30.1, 31.2, 'A stop']);
  stopsSheet.addRow(['B', 30.2, 31.3, 'B stop']);

  const outputPath = path.join(process.cwd(), 'tmp-debug-import.xlsx');
  await workbook.xlsx.writeFile(outputPath);
  console.log('Wrote', outputPath);

  const { default: fetch } = await import('node-fetch');
  const formData = new FormData();
  formData.append('file', new Blob([fs.readFileSync(outputPath)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'tmp-debug-import.xlsx');

  const response = await fetch('http://localhost:3000/api/admin/addMatchedData', { method: 'POST', body: formData });
  const text = await response.text();
  console.log('status', response.status);
  console.log(text);
})();
