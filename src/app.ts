import Graphic = require("esri/Graphic");
import EsriMap = require("esri/Map");

import Collection = require("esri/core/Collection");

import Point = require("esri/geometry/Point");

import GraphicsLayer = require("esri/layers/GraphicsLayer");
import StreamLayer = require("esri/layers/StreamLayer");

import UniqueValueRenderer = require("esri/renderers/UniqueValueRenderer");

import SceneView = require("esri/views/SceneView");
import StreamLayerView = require("esri/views/layers/StreamLayerView");

import { createLineGraphics, createStationGraphics, getTrainLocation, getTrainSymbol, getSymbolPNG, NAME_MAP, COLOR_MAP } from "./appUtils";
import { SelectedTrain, LineWidgets, TrackCount, TrainAlert } from "typings/interfaces";

import StationTracker = require("./StationTracker");

const STREAM_SERVICE_URL = "https://idtsteelags.esri.com/arcgis/rest/services/dc-trains/StreamServer";

// Track id => Graphic map
const trainMap: HashMap<Graphic> = {};

// Widgets will be stored on this object
const lineWidgets: LineWidgets = {
  RD: null,
  OR: null,
  YL: null,
  GR: null,
  BL: null,
  SV: null,
  YLRP: null
};

// All lines are shown to start, may be toggled off
const trainsShown = [
  "RD",
  "OR",
  "YL",
  "GR",
  "BL",
  "SV",
  "YLRP"
];

// Current alerts
const trainAlerts: Collection<TrainAlert> = new Collection([]);
const highlightHandles: HashMap<any> = {};
let alertInterval: any = {
  id: null,
  intervalId: null
};

// If a popup is open, store some information about it here
const selectedTrain: SelectedTrain = {
  id: null,
  intervalId: null,
  secondsSinceMoved: null,
  lastCircuit: null
};

function createStreamLayer(map: EsriMap, metroData: any, lines: any, view: SceneView): void {
  // create StreamLayer
  const layer = new StreamLayer({
    url: STREAM_SERVICE_URL,
    // show seconds since moved in popup
    // also add an alert action
    popupTemplate: {
      title: "{LineCode} line train {TrainId}",
      content: "{SecondsAtLocation} seconds at this position",
      actions: [
        {
          title: "Add alert",
          id: "train-alert",
          className: "esri-icon-locate"
        },
        {
          title: "Remove alert",
          id: "remove-train-alert",
          className: "esri-icon-close"
        }
      ]
    },
    // color each train based on its line
    renderer: new UniqueValueRenderer({
      field: "LineCode",
      uniqueValueInfos: [
        {
          value: "RD",
          symbol: getTrainSymbol("red", "black"),
          label: "Red line"
        },
        {
          value: "OR",
          symbol: getTrainSymbol("orange", "black"),
          label: "Orange line"
        },
        {
          value: "YL",
          symbol: getTrainSymbol("yellow", "black"),
          label: "Yellow line"
        },
        {
          value: "GR",
          symbol: getTrainSymbol("green", "black"),
          label: "Green line"
        },
        {
          value: "BL",
          symbol: getTrainSymbol("blue", "black"),
          label: "Blue line"
        },
        {
          value: "SV",
          symbol: getTrainSymbol("silver", "black"),
          label: "Silver line"
        },
        {
          value: "YLRP",
          symbol: getTrainSymbol("gold", "black"),
          label: "Yellow rapid line"
        },
      ]
    })
  });
  map.layers.add(layer);

  // Add action listeners
  view.popup.on("trigger-action", event => {
    // add train alert
    if (event.action.id === "train-alert"){
      const feature = event.target.features[0];
      if (feature) {
        const exists = trainAlerts.find(alert => alert.id === feature.attributes.TrainId);
        if (!exists) {
          trainAlerts.push({
            id: feature.attributes.TrainId
          });
        }
      }
    }

    // remove train alert
    if (event.action.id === "remove-train-alert"){
      const feature = event.target.features[0];
      const id = feature.attributes.TrainId;
      if (feature) {
        const alert = trainAlerts.find(alert => alert.id === id);
        if (alertInterval.id === id) {
          alertInterval.id = null;
          clearInterval(alertInterval.intervalId);
          view.highlightOptions.haloOpacity = 1;
        }
        if (highlightHandles[id]) {
          highlightHandles[id].remove();
          delete highlightHandles[id];
        }
        trainAlerts.remove(alert);
      }
    }
  });

  streamLayer = layer;
  layer.on("layerview-create", event => {
    const layerView = event.layerView as StreamLayerView;
    layerView.on("data-received", (message: any) => {
      const point = getTrainLocation(message, metroData, lines);
      if (point) {
        message.geometry = point;
      }
    });

    const graphicsCollecion = layerView.get<Collection<Graphic>>("graphics");
    
    graphicsCollecion.on("change", changes => {
      changes.added.forEach((graphic: Graphic) => {
        const id = graphic.attributes.TrainId;
        trainAlerts.forEach(alert => {
          if (alert.id === id) {
            const previous = trainMap[id];
            if (previous) {
              const previousPoint = previous.geometry as Point;
              const currentPoint = graphic.geometry as Point;
              const distance = previousPoint.distance(currentPoint);
              if (distance > 0) {
                showTrainAlert(view, graphic, distance);
              }
            }
            else {
              showTrainAlert(view, graphic)
            }
          }
        })
        trainMap[id] = graphic;
      });
    });

    graphicsCollecion.on("after-changes", changes => {
      for (let lineCode in lineWidgets) {
        if (lineWidgets[lineCode]) {
          lineWidgets[lineCode].trackCount = getTrainsOnLine(lineCode);
        }
      }
    });
  });
}

function showTrainAlert(view: SceneView, graphic: Graphic, distance?: number): void {
  const id = graphic.attributes.TrainId;
    getSymbolPNG(graphic.get("layer.renderer")["getSymbol"](graphic)).then(png => {
      const notification = new Notification(`Train #${id}`, {
        body: distance ? `Distance changed: ${distance.toFixed(3)} meters.` : `First position update.`,
        icon: png
      });
      notification.onclick = () => {
        view.goTo(graphic);
      }
    });
  if (Notification["permission"] === "granted") {
  }
  const streamLayer = graphic.layer;
  const streamLayerView = view.layerViews.find(lv => lv.layer === streamLayer) as StreamLayerView;
  highlightHandles[id] = streamLayerView["highlight"](graphic);

  clearInterval(alertInterval.intervalId);
  view.highlightOptions.haloOpacity = 1;
  alertInterval.id = id;
  alertInterval.intervalId = setInterval(() => {
    view.highlightOptions = {
      haloOpacity: view.highlightOptions.haloOpacity === 1 ? .2 : 1
    }
  }, 1000);

  setTimeout(() => {
    if (highlightHandles[id]) {
      highlightHandles[id].remove();
      delete highlightHandles[id];
    }
    if (alertInterval.id === id) {
      alertInterval.id = null;
      clearInterval(alertInterval.intervalId);
      view.highlightOptions.haloOpacity = 1;
    }
  }, 10000);
}

// find the number of trains on each line
function getTrainsOnLine(lineCode: string): TrackCount {
  const count = { track1: 0, track2: 0 };
  for (let key in trainMap) {
    const { LineCode, DirectionNum } = trainMap[key].attributes;
    if (LineCode == lineCode) {
      if (DirectionNum === 1) {
        count.track1 += 1;
      }
      else if (DirectionNum === 2) {
        count.track2 += 1; 
      }
    }

  }
  return count;
}

// A GraphicsLayer to hold stations
const stationsLayer = new GraphicsLayer();
stationsLayer.set("popupTemplate", {
  title: "{name}",
  content: [
    {
      type: "fields", 
      fieldInfos: [
        {
          fieldName: "lines",
          label: "Lines",
          visible: true
        },
        {
          fieldName: "longitude",
          label: "Longitude",
          visible: true
        },
        {
          fieldName: "latitude",
          label: "Latitude",
          visible: true
        }
      ]
    }
  ]
});

// A GraphicsLayer to hold station labels
const calloutsLayer = new GraphicsLayer();
calloutsLayer.set("featureReduction", { type: "selection" });

// A GraphicsLayer to hold lines
const linesLayer = new GraphicsLayer();

let streamLayer: StreamLayer;

function addStations(stationData: any): void {
  const nameSet = {};
  for (let line in stationData) {
    stationData[line].forEach((stationInfo: any) => {
      if (!nameSet[stationInfo.name]) {
        stationsLayer.add(stationInfo.station);
        nameSet[stationInfo.name] = true;
      }
    });
  }
}

function startSecondCounter(popup: any, graphic: Graphic): void {
  selectedTrain.intervalId = setInterval(() => {
    selectedTrain.secondsSinceMoved += 1;
    popup.set("content", `${selectedTrain.secondsSinceMoved} seconds at this position`);
  }, 1000);
}

function stopSecondCounter(): void {
  if (selectedTrain.intervalId !== null) {
    clearInterval(selectedTrain.intervalId);
  }
}

function resetSelectedTrain(): void {
  selectedTrain.secondsSinceMoved = null;
  selectedTrain.lastCircuit = null;
  selectedTrain.id = null;
  stopSecondCounter();
}

function attachPopupListeners(view: SceneView): void {
  view.watch("popup.visible", visible => {
    if (!visible) {
      resetSelectedTrain();
    }
  });

  view.watch("popup.selectedFeature", graphic => {
    if (!view.popup.dockEnabled) {
      view.popup.dockEnabled = true;
    }
    if (graphic && graphic.attributes.TrainId && (!selectedTrain.id || selectedTrain.id !== graphic.attributes.TrainId)) {
      selectedTrain.id = graphic.get("attributes.TrainId");
      selectedTrain.secondsSinceMoved = graphic.get("attributes.SecondsAtLocation");
      selectedTrain.lastCircuit = graphic.get("attributes.CircuitId");
      stopSecondCounter();
      startSecondCounter(view.popup, graphic);
    }
    else if (graphic === null || !selectedTrain.id || !graphic.attributes.TrainId) {
      resetSelectedTrain();
    }
  });

  view.watch("popup.title", title => {
    if (!title && selectedTrain.id !== null) {
      const newGraphic = trainMap[selectedTrain.id] as Graphic;
      const newCircuit = newGraphic.get<number>("attributes.CircuitId");
      if (selectedTrain.lastCircuit !== newCircuit) {
        selectedTrain.lastCircuit = newCircuit;
        selectedTrain.secondsSinceMoved = 0;
      }
      newGraphic.set("attributes.SecondsAtLocation", selectedTrain.secondsSinceMoved);
      const popupOptions: any = {
        features: [newGraphic]
      };
      view.popup.open(popupOptions);
    }
  });
}

// Create a StationTracker widget for each line and attach to view
const attachWidgets = (view: SceneView, lineData: any, stationData: any) => {
  for (let line in lineWidgets) {
    const widget = new StationTracker({
      view,
      labelsLayer: calloutsLayer,
      lineName: NAME_MAP[line],
      lineCode: line,
      lineData: lineData[line],
      stationData: stationData[line],
      trackLayer: linesLayer,
      trackCount: { track1: 0, track2: 0 },
      color: COLOR_MAP[line],
      container: document.getElementsByClassName(line)[0]
    });

    // listen for filter events: apply the new filter
    widget.on("filter-trains", (event: any) =>  {
      const { line, show } = event;
      if (!show) {
        removeGraphics(line, view);
      }
      streamLayer.updateFilter(makeFilter(line, show));
    });
    lineWidgets[line] = widget;
  }
}

// Create a filter for the stream layer
function makeFilter(line: string, show: boolean): any {
  if (show) {
    trainsShown.push(line);
  }
  else {
    trainsShown.splice(trainsShown.indexOf(line), 1);;
  }

  const clause = trainsShown.reduce((query: string, current: string) => {
    return query.length > 0 ?
      `${query} OR LineCode = '${current}'` :
      `LineCode = '${current}'`;
  },"");

  return {
    where: clause
  };
}

// Remove graphics from the StreamLayer on filter
function removeGraphics(line: string, view: SceneView): void {
  const layerView = view.layerViews.find((lv: any) => lv.layer === streamLayer);
  const toRemove = layerView.get<Collection<Graphic>>("graphics").filter(graphic => {
    return graphic.get("attributes.LineCode") === line;
  }).toArray();
  layerView.get<Collection<Graphic>>("graphics").removeMany(toRemove);
}


// App entry-point
function start(metroData: any): SceneView {
  const map = new EsriMap({
    basemap: "topo",
    ground: "world-elevation",
    layers: [linesLayer, stationsLayer, calloutsLayer]
  });

  const view = new SceneView({
    map,
    highlightOptions: {
      fillOpacity: 0,
      haloOpacity: 1
    },
    popup: {
      dockEnabled: true,
      dockOptions: {
        buttonEnabled: false,
        position: "bottom-center",
        breakpoint: "false"
      }
    },
    container: "viewDiv",
    viewingMode: "local",
    clippingArea: metroData.extent,
    extent: metroData.extent,
    environment: {
      atmosphereEnabled: false,
      starsEnabled: false
    }
  });

  view.clippingArea = view.clippingArea.expand(1.2);

  const lines = createLineGraphics(metroData.lines);
  const stations = createStationGraphics(metroData.stations);

  addStations(stations);
  linesLayer.addMany(lines.allTracks);

  createStreamLayer(map, metroData, lines, view);
  attachPopupListeners(view);
  attachWidgets(view, lines, stations);
  return view;
};

export = {
  start
};