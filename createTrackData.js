const request = require("request-promise-native");
const fs = require("fs");

const API_KEY = "635e0ed2348f420cbe874f1bcd5d1b11";
const STATION_INFO_URL = "https://api.wmata.com/Rail.svc/json/jStations";
const CIRCUIT_INFO_URL = "https://api.wmata.com/TrainPositions/StandardRoutes?contentType=json";

function getStationInformation() {
	return request(`${STATION_INFO_URL}?api_key=${API_KEY}`)
	.then(body => {
		return JSON.parse(body).Stations;
	});
}

function getCicuitInformation() {
	return request(`${CIRCUIT_INFO_URL}&api_key=${API_KEY}`)
	.then(body => {
		return JSON.parse(body).StandardRoutes;
	});
}

function addGeographicInfo(track, stationData) {
	let circuitCounter = 0;
  const extent = {
    xmin: Infinity,
    ymin: Infinity,
    xmax: -Infinity,
    ymax: -Infinity
  }
	track.TrackCircuits.forEach(circuit => {
		const stationInfo = stationData.find(d => d.Code === circuit.StationCode);
		if (stationInfo) {
      const { Lat, Lon } = stationInfo;
      if (Lon < extent.xmin) {
        extent.xmin = Lon;
      }
      if (Lon > extent.xmax) {
        extent.xmax = Lon;
      }
      if (Lat < extent.ymin) {
        extent.ymin = Lat;
      }
      if (Lat > extent.ymax) {
        extent.ymax = Lat;
      }
			circuit.longitude = Lon;
			circuit.latitude = Lat;
			circuit.name = stationInfo.Name;
			circuit.numPreviousCircuits = circuitCounter;
			circuitCounter = 0;
		}
		else {
			circuitCounter++;
		}
	});
  stationData.extent = stationData.extent ?
    extentUnion(stationData.extent, extent) :
    extent;
}

function extentUnion(extent1, extent2) {
  return {
    xmin: Math.min(extent1.xmin, extent2.xmin),
    ymin: Math.min(extent1.ymin, extent2.ymin),
    xmax: Math.max(extent1.xmax, extent2.xmax),
    ymax: Math.max(extent1.ymax, extent2.ymax)
  }
}

function createLineInformation() {
	const returnObject = {
		lines: {

		},
		extent: null,
		stations: []
	};
	return Promise.all([getStationInformation(), getCicuitInformation()])
	.then(data => {
		const [stationData, circuitData] = data;
		const lines = new Set(circuitData.map(data => data.LineCode));
		lines.forEach(lineCode => {
			const track1 = circuitData.find(d => d.LineCode === lineCode && d.TrackNum === 1);
			const track2 = circuitData.find(d => d.LineCode === lineCode && d.TrackNum === 2);
			addGeographicInfo(track1, stationData);
			addGeographicInfo(track2, stationData);
			returnObject.lines[lineCode] = {
				track1,
				track2
			}
		});

		const nameSet = new Set();
		const stations = [];
		for (let i = 0; i < stationData.length; i++) {
			if (nameSet.has(stationData[i].Name)) {
				const lines = stations.find(s => s.Name === stationData[i].Name).lines;
				if (stationData[i].LineCode1) lines.push(stationData[i].LineCode1);
				if (stationData[i].LineCode2) lines.push(stationData[i].LineCode2);
				if (stationData[i].LineCode3) lines.push(stationData[i].LineCode3);
				if (stationData[i].LineCode4) lines.push(stationData[i].LineCode4);
			}
			else {
				nameSet.add(stationData[i].Name);
				stationData[i].lines = [];
				if (stationData[i].LineCode1) stationData[i].lines.push(stationData[i].LineCode1);
				if (stationData[i].LineCode2) stationData[i].lines.push(stationData[i].LineCode2);
				if (stationData[i].LineCode3) stationData[i].lines.push(stationData[i].LineCode3);
				if (stationData[i].LineCode4) stationData[i].lines.push(stationData[i].LineCode4);
				stations.push(stationData[i])
			}
		}
		returnObject.stations = stations;
    returnObject.extent = stationData.extent;

		return returnObject
	});
}

createLineInformation()
.then(dataJSON => {
  fs.writeFile("dist/metroData.json", JSON.stringify(dataJSON, null, 2), "utf8", err => console.log(err));
});
