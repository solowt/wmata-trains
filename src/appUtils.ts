import Graphic = require("esri/Graphic");

import Circle = require("esri/geometry/Circle");
import geometryEngine = require("esri/geometry/geometryEngine");
import Point = require("esri/geometry/Point");
import Polyline = require("esri/geometry/Polyline");
import SpatialReference = require("esri/geometry/SpatialReference");

import webMercatorUtils = require("esri/geometry/support/webMercatorUtils");

import SimpleMarkerSymbol = require("esri/symbols/SimpleMarkerSymbol");
import symbolPreview = require("esri/symbols/support/symbolPreview");

export const COLOR_MAP = {
  RD: "red",
  OR: "orange",
  YL: "yellow",
  GR: "green",
  BL: "blue",
  SV: "silver",
  YLRP: "gold"
};

export const NAME_MAP = {
  RD: "RED",
  OR: "ORANGE",
  YL: "YELLOW",
  GR: "GREEN",
  BL: "BLUE",
  SV: "SILVER",
  YLRP: "YELLOW-RAPID"
}

const serializer = new XMLSerializer();

const LINE_SYMBOLS = {
  RD: {
    type: "line-3d",
    symbolLayers: [{
      type: "path",
      size: 200,
      material: { color: COLOR_MAP.RD }
    }]
  },
  OR: {
    type: "line-3d",
    symbolLayers: [{
      type: "path",
      size: 200,
      material: { color: COLOR_MAP.OR }
    }]
  },
  YL: {
    type: "line-3d",
    symbolLayers: [{
      type: "path",
      size: 200,
      material: { color: COLOR_MAP.YL }
    }]
  },
  GR: {
    type: "line-3d",
    symbolLayers: [{
      type: "path",
      size: 200,
      material: { color: COLOR_MAP.GR }
    }]
  },
  BL: {
    type: "line-3d",
    symbolLayers: [{
      type: "path",
      size: 200,
      material: { color: COLOR_MAP.BL }
    }]
  },
  YLRP: {
    type: "line-3d",
    symbolLayers: [{
      type: "path",
      size: 200,
      material: { color: COLOR_MAP.YLRP }
    }]
  },
  SV: {
    type: "line-3d",
    symbolLayers: [{
      type: "path",
      size: 200,
      material: { color: COLOR_MAP.SV }
    }]
  }
}

// Get position for a train message
export function getTrainLocation(message: any, metroData: any, lineData: any): any {
  if (!message.attributes || !message.attributes.LineCode) {
    return null;
  }
  const lineCode = message.attributes.LineCode;
  const trackNumber = message.attributes.DirectionNum === 1 ? "track1" : "track2";
  const track = metroData.lines[lineCode][trackNumber].TrackCircuits;
  const circuitId = message.attributes.CircuitId;
  let foundCircuit = false;
  let nextStation = null;
  let previousStation = null;
  let trainSequenceId = null;
  for (let i = 0; i < track.length; i++) {
    if (track[i].CircuitId === circuitId) {
      foundCircuit = true;
      trainSequenceId = track[i].SeqNum;
    }
    if (foundCircuit && track[i].name) {
      nextStation = track[i];
      break;
    }
    if (track[i].name) {
      previousStation = track[i];
    }
  }

  if (!previousStation || !nextStation || (trainSequenceId === null)) {
    return null;
  }

  const previousStationPoint = new Point({
    x: previousStation.longitude,
    y: previousStation.latitude
  });
  const nextStationPoint = new Point({
    x: nextStation.longitude,
    y: nextStation.latitude
  });
  const dx = nextStationPoint.x - previousStationPoint.x;
  const dy = nextStationPoint.y - previousStationPoint.y;

  const numCircuitsBetween = nextStation.SeqNum - previousStation.SeqNum;
  const normalizedId = trainSequenceId - previousStation.SeqNum;
  const journeyCompleted = normalizedId / numCircuitsBetween;
  const x = previousStationPoint.x + journeyCompleted * dx;
  const y = previousStationPoint.y + journeyCompleted * dy;
  const p = webMercatorUtils.geographicToWebMercator(new Point({
    x,
    y,
    spatialReference: SpatialReference.WGS84
  }) as any);
  const pointOnTrack = geometryEngine.nearestCoordinate(lineData[lineCode][trackNumber].geometry, p as Point).coordinate;
  return {
    x: pointOnTrack.x,
    y: pointOnTrack.y,
    z: 1700,
    spatialReference: { wkid: 102100 }
  };
}

// Create graphics for each line
export function createLineGraphics(metroLines: any): { allTracks: Graphic[] } {
  let height = 0;
  const lines = {
    allTracks: new Array()
  };
  for (let line in metroLines) {
    height += 200;
    const lineGeometry = getPolyline(metroLines[line].track1);
    const trackOneGeometry = geometryEngine.offset(lineGeometry, -175, "meters", "square") as Polyline;
    const trackTwoGeometry = geometryEngine.offset(lineGeometry, 175, "meters", "square") as Polyline;
    trackOneGeometry.paths[0].forEach(point => point.push(height));
    trackTwoGeometry.paths[0].forEach(point => point.push(height));
    trackOneGeometry.hasZ = true;
    trackTwoGeometry.hasZ = true;
    const track1 = new Graphic({
      geometry: trackOneGeometry,
      symbol: LINE_SYMBOLS[line]
    });
    const track2 = new Graphic({
      geometry: trackTwoGeometry,
      symbol: LINE_SYMBOLS[line]
    });

    lines.allTracks.push(track1, track2);
    lines[line] = {
      track1: track1,
      track2: track2
    };
  }
  return lines;
}

// Create graphics for each station
export function createStationGraphics(stations: any[]): {} {
  const graphics: any = {
    RD: [],
    OR: [],
    YL: [],
    BL: [],
    SV: [],
    GR: [],
    YLRP: []
  };
  stations.forEach(station => {
    const [x, y] = webMercatorUtils.lngLatToXY(station.Lon, station.Lat);
    const attributes = {
      name: station.Name,
      lines: station.lines.join(", "),
      longitude: station.Lon,
      latitude: station.Lat
    }
    const stationGraphic = new Graphic({
      attributes,
      geometry: new Circle({
        radius: 100,
        center: new Point({
          x,
          y,
          spatialReference: SpatialReference.WebMercator
        }),
        spatialReference: SpatialReference.WebMercator
      }),
      symbol: {
        type: "polygon-3d",
        symbolLayers: [
          {
            type: "extrude",
            size: 1600,
            material: { color: [0,0,0,.6] }
          }
        ]
      }
    });
    const stationCallout = new Graphic({
      attributes,
      geometry: new Point({
        x,
        y,
        z: 1600,
        spatialReference: SpatialReference.WebMercator
      }),
      symbol: {
        type: "point-3d",
        symbolLayers: [
          {
            type: "text",
            material: { color: "black" },
            halo: {
              color: "white",
              size: 1,
            },
            text: station.Name,
            size: 14
          }
        ],
        verticalOffset: {
          screenLength: 60
        },
        callout: {
          type: "line",
          size: 1.5,
          color: "white",
          border: {
            color: "black"
          }
        }
      }
    })
    const stationInfo = {
      name: station.Name,
      callout: stationCallout,
      station: stationGraphic
    };
    station.lines.forEach((lineCode: string) => {
      graphics[lineCode].push(stationInfo);
    });
  });
  return graphics;
}

export function getTrainSymbol(color: string|number[], outlineColor: string|number[]): any {
  return new SimpleMarkerSymbol({
    color: color,
    size: 8,
    outline: {
      color: outlineColor,
      width: 2
    }
  });
}

function getPolyline(lineData: any): Polyline {
  const path = lineData.TrackCircuits
  .filter((circuit: any) => circuit.longitude && circuit.latitude)
  .reduce((accum: any, current: any) => {
    return accum.concat([webMercatorUtils.lngLatToXY(current.longitude, current.latitude)]);
  }, []);
  return new Polyline({
    paths: [path],
    spatialReference: SpatialReference.WebMercator
  });
}

export function getSymbolPNG(symbol: any): Promise<string> {
  return new Promise((resolve, reject) => {
    symbolPreview.renderPreviewHTML(symbol, {
      size: 75
    }).then(html => {
      const svg = serializer.serializeToString(html.firstChild);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const image = new Image();
      image.onload = () => {
        ctx.drawImage(image, 50, 0);
        resolve(canvas.toDataURL("image/png"));
      }
      image.src = `data:image/svg+xml;utf8,${svg}`;
    });
  });
}