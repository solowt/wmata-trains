/**
 * The StationTracker provides a widget to keep track of a WMATA rail station
 */

import {
  renderable,
  tsx,
  join
} from "esri/widgets/support/widget";

import {
  aliasOf,
  subclass,
  property,
  declared
} from "esri/core/accessorSupport/decorators";

import GraphicsLayer = require("esri/layers/GraphicsLayer");
import Widget = require("esri/widgets/Widget");
import StationTrackerViewModel = require("./StationTrackerViewModel");
import View = require("esri/views/View");
import { TrackCount } from "typings/interfaces";

const CSS: any = {
  base: "station-tracker esri-widget",
  lineName: "station-tracker__line-name",
  trackCount: "station-tracker__track-count",
  trackNumber: "station-tracker__track-count__number",
  trackLabel: "station-tracker__track-label",
  labelToggle: "station-tracker__label-toggle",
  labelToggleHighlighted: "station-tracker__label-toggle--highlighted",
  toolsHolder: "station-tracker__tools-holder",

  mapPin: "esri-icon-map-pin",
  widgetButton: "esri-widget-button"
};

@subclass("esri.widgets.StationTracker")
class StationTracker extends declared(Widget) {

  constructor(params?: any) {
    super();
  }

  private _labelsVisible: boolean = false;
  private _trainsVisible: boolean = true;

  //--------------------------------------------------------------------------
  //
  //  Properties
  //
  //--------------------------------------------------------------------------

  /**
   * The color for the line name.
   *
   */
  @property()
  color: string = null;  

  /**
   * The layer that holds the labels for each station
   *
   */
  @aliasOf("viewModel.labelsLayer")
  labelsLayer: GraphicsLayer = null;

  /**
   * The code name of the line
   *
   */
  @aliasOf("viewModel.lineCode")
  lineCode: string = null;

  /**
   * The lineData object
   *
   */
  @aliasOf("viewModel.lineData")
  lineData: any = null;

  /**
   * The name of the line
   *
   */
  @aliasOf("viewModel.lineName")
  lineName: string = null;

  /**
   * The stationData object, has references to station graphics and labels.
   *
   */
  @aliasOf("viewModel.stationData")
  stationData: any = null;

  //----------------------------------
  //  view
  //----------------------------------

  /**
   * A reference to the view that this widget is attached to.
   *
   */
  @aliasOf("viewModel.view")
  @renderable()
  view: View = null;

  /**
   * A reference to the view that this widget is attached to.
   *
   */
  @aliasOf("viewModel.trackCount")
  @renderable()
  trackCount: TrackCount = null;

  /**
   * A reference to the view that this widget is attached to.
   *
   */
  @aliasOf("viewModel.trackLayer")
  trackLayer: GraphicsLayer = null;

  /**
   * The view model for this widget. Provides functionality for the widget.
   */
  @property({
    type: StationTrackerViewModel
  })
  @renderable("viewModel.state")
  viewModel: StationTrackerViewModel = new StationTrackerViewModel();

  //--------------------------------------------------------------------------
  //
  //  Public Methods
  //
  //--------------------------------------------------------------------------

  render() {
    const lineName = this.lineName.toUpperCase();
    const trackCount = this._renderTrackCount();
    const labelToggle = this._renderLabelToggle();
    const trainsToggle = this._renderTrainToggle();

    const titleStyles = {
      color: this.color
    };

    return (
      <div bind={this} 
        class={CSS.base}>
        <h5 class={CSS.lineName}
          styles={titleStyles}>
          {lineName}
        </h5>
        {trackCount}
        <div class={CSS.toolsHolder}>
          {labelToggle}
          {trainsToggle}
        </div>
      </div>
    );
  }

  toggleHighlight(event: any): void {
    const { target } = event;
    const trackNumber = Number(target.getAttribute("data-track"));
    this.viewModel.toggleHighlight(trackNumber);
  }

  toggleLabels(event: any): void {
    if (!this._labelsVisible) {
      this.viewModel.addStationLabels();
      this._labelsVisible = true;
    }
    else {
      this.viewModel.removeStationLabels();
      this._labelsVisible = false;
    }
  }

  toggleTrainVisibility(event: any): void {
    const { target } = event;
    this._trainsVisible = target.checked;
    this.emit("filter-trains", {
      line: this.lineCode,
      show: this._trainsVisible
    });
  }

  //--------------------------------------------------------------------------
  //
  //  Private Methods
  //
  //--------------------------------------------------------------------------

  _renderTrackCount(): any {
    const { track1, track2 } = this.trackCount;
    return (
      <div class={CSS.trackCount}>
        <div>
          <label bind={this}
            class={CSS.trackLabel}
            data-track="1"
            onmouseenter={this.toggleHighlight}
            onmouseleave={this.toggleHighlight}>
            Track 1
          </label>
          <div class={CSS.trackNumber}>
            {track1} trains
          </div>
        </div>
        <div>
          <label bind={this}
            class={CSS.trackLabel}
            data-track="2"
            onmouseenter={this.toggleHighlight}
            onmouseleave={this.toggleHighlight}>
            Track 2
          </label>
          <div class={CSS.trackNumber}>
            {track2} trains
          </div>
        </div>
      </div>
    )
  }

  _renderLabelToggle(): any {
    const labelClasses = {
      [CSS.labelToggleHighlighted]: this._labelsVisible
    };

    return (
      <div bind={this} 
        class={join(CSS.labelToggle, CSS.widgetButton, CSS.mapPin)}
        classes={labelClasses}
        onclick={this.toggleLabels}
        title="Toggle station labels">
      </div>
    )
  }

  _renderTrainToggle(): any {
    return (
      <input bind={this} 
        type="checkbox"
        checked={this._trainsVisible}
        onchange={this.toggleTrainVisibility}
        title="Show trains"/>
    )
  }

}

export = StationTracker;