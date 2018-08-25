/**
 * Provides the logic for the StationTracker widget.
 */

import Accessor = require("esri/core/Accessor");
import Evented = require("esri/core/Evented");
import { subclass, property, declared } from "esri/core/accessorSupport/decorators";

import GraphicsLayer = require("esri/layers/GraphicsLayer");
import MapView = require("esri/views/MapView");
import SceneView = require("esri/views/SceneView");
import { TrackCount } from "typings/interfaces";
import SceneLayerView = require("esri/views/layers/SceneLayerView")

type State = "ready" | "disabled";

@subclass("esri.widgets.StationTracker.StationTrackerViewModel")
class StationTrackerViewModel extends declared(Accessor, Evented) {

  constructor(params?: any) {
    super(params);
  }

  destroy() {
    this.view = null;
  }

  private _highlightHandles: HashMap<any> = {};

  //--------------------------------------------------------------------------
  //
  //  Properties
  //
  //--------------------------------------------------------------------------

  /**
   * The layer that holds the labels for each station
   *
   */
  @property()
  labelsLayer: GraphicsLayer = null;

  /**
   * The code name of the line
   *
   */
  @property()
  lineCode: string = null;

  /**
   * The name of the line.
   *
   */
  @property()
  lineName: string = null;

  /**
   * The view model's state.
   */
  @property({
    dependsOn: ["view.ready"],
    readOnly: true
  })
  get state(): State {
    return this.get("view.ready") ? "ready" : "disabled";
  }

  /**
   * The lineData object, has references to line graphics.
   *
   */
  @property()
  lineData: any = null;

  /**
   * The stationData object, has references to station graphics and labels.
   *
   */
  @property()
  stationData: any = null;

  /**
   * The view from which the widget will operate.
   */
  @property()
  view: MapView | SceneView = null;

  /**
   * Keeps track of how many trains are on this line
   *
   */
  @property()
  trackCount: TrackCount = null;

  /**
   * The graphics layer that holds the track graphics, needed for highlighting
   *
   */
  @property()
  trackLayer: GraphicsLayer = null;

  //--------------------------------------------------------------------------
  //
  //  Public Methods
  //
  //--------------------------------------------------------------------------

  toggleHighlight(trackNumber: number): void {
    const track = trackNumber === 1 ? "track1" : "track2";
    if (this._highlightHandles[track]) {
      this._highlightHandles[track].remove();
      this._highlightHandles[track] = null;
      return;
    }
    const trackGraphic = this.lineData[track];
    const trackLayerView = this.view.layerViews.find(lv => lv.layer === this.trackLayer) as SceneLayerView;
    if (trackLayerView) {
      this._highlightHandles[track] = trackLayerView.highlight(trackGraphic);
    }
  }

  addStationLabels(): void {
    this.labelsLayer.addMany(this.stationData.map((data: any) => data.callout));
  }

  removeStationLabels(): void {
    this.labelsLayer.removeMany(this.stationData.map((data: any) => data.callout));
  }
}

export = StationTrackerViewModel;

