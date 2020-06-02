import React from 'react';
import T from 'prop-types';
import styled from 'styled-components';
import { connect } from 'react-redux';
import get from 'lodash.get';
import find from 'lodash.find';

import App from '../../common/app';
import {
  Inpage,
  InpageHeader,
  InpageHeaderInner,
  InpageHeadline,
  InpageTitle,
  InpageBody
} from '../../../styles/inpage';
import MbMap from '../../common/mb-map-explore/mb-map';
import UhOh from '../../uhoh';
import LineChart from '../../common/line-chart/chart';
import DataLayersBlock from '../../common/data-layers-block';
import Panel, { PanelHeadline, PanelTitle } from '../../common/panel';
import MapMessage from '../../common/map-message';
import Timeline from '../../common/timeline';

import { themeVal } from '../../../styles/utils/general';
import { glsp } from '../../../styles/utils/theme-values';
import { fetchSpotlightSingle as fetchSpotlightSingleAction } from '../../../redux/spotlight';
import { wrapApiResult, getFromState } from '../../../redux/reduxeed';
import { showGlobalLoading, hideGlobalLoading } from '../../common/global-loading';
import { utcDate } from '../../../utils/utils';
import allMapLayers from '../../common/layers';
import {
  setLayerState,
  getLayerState,
  getLayersWithState,
  resizeMap,
  getInitialMapExploreState,
  handlePanelAction,
  getUpdatedActiveLayersState,
  toggleLayerCompare,
  toggleLayerRasterTimeseries,
  getActiveTimeseriesLayers
} from '../../../utils/map-explore-utils';
import ShadowScrollbar from '../../common/shadow-scrollbar';

const layersBySpotlight = {
  be: ['no2', 'car-count'],
  du: ['no2'],
  gh: ['no2'],
  la: ['no2'],
  sf: ['no2'],
  tk: ['no2', 'nightlights']
};

const ExploreCanvas = styled.div`
  display: grid;
  height: 100%;
  grid-template-columns: min-content 1fr min-content;
  overflow: hidden;

  > * {
    grid-row: 1;
  }
`;

const ExploreCarto = styled.section`
  position: relative;
  height: 100%;
  background: ${themeVal('color.baseAlphaA')};
  display: grid;
  grid-template-rows: 1fr auto;
`;

const PrimePanel = styled(Panel)`
  width: 18rem;
`;

const SecPanel = styled(Panel)`
  width: 24rem;
`;

const BodyScroll = styled(ShadowScrollbar)`
  flex: 1;
  z-index: 1;
`;

const PanelBodyInner = styled.div`
  padding: ${glsp()};
`;

class SpotlightAreasSingle extends React.Component {
  constructor (props) {
    super(props);
    // Functions from helper file.
    this.setLayerState = setLayerState.bind(this);
    this.getLayerState = getLayerState.bind(this);
    this.getLayersWithState = getLayersWithState.bind(this);
    this.toggleLayerCompare = toggleLayerCompare.bind(this);
    this.getActiveTimeseriesLayers = getActiveTimeseriesLayers.bind(this);
    this.resizeMap = resizeMap.bind(this);

    this.onMapAction = this.onMapAction.bind(this);
    this.onPanelAction = this.onPanelAction.bind(this);
    // Ref to the map component to be able to trigger a resize when the panels
    // are shown/hidden.
    this.mbMapRef = React.createRef();

    this.state = {
      ...getInitialMapExploreState()
    };
  }

  componentDidMount () {
    this.requestSpotlight();
  }

  componentDidUpdate (prevProps, prevState) {
    const { spotlightId } = this.props.match.params;
    if (spotlightId !== prevProps.match.params.spotlightId) {
      this.requestSpotlight();
      // Reset state on page change.
      this.setState(getInitialMapExploreState());
    }
  }

  async requestSpotlight () {
    showGlobalLoading();
    await this.props.fetchSpotlightSingle(this.props.match.params.spotlightId);
    hideGlobalLoading();
  }

  onPanelAction (action, payload) {
    // Returns true if the action was handled.
    handlePanelAction.call(this, action, payload);
  }

  async onMapAction (action, payload) {
    switch (action) {
      case 'map.loaded': {
        const spotlightData = this.props.spotlight.getData();
        this.mbMapRef.current.mbMap.fitBounds(spotlightData.bounding_box);
        this.setState({ mapLoaded: true });
        // Enable default layers sequentially so they trigger needed actions.
        const layersToLoad = this.props.mapLayers.filter((l) => l.enabled);
        for (const l of layersToLoad) {
          await this.toggleLayer(l);
        }
        break;
      }
    }
  }

  async toggleLayer (layer) {
    const layerId = layer.id;

    if (layer.type === 'raster-timeseries') {
      toggleLayerRasterTimeseries.call(this, layer);
    }

    // If we disable a layer we're comparing, disable the comparison as well.
    if (this.getLayerState(layerId, 'comparing')) {
      this.toggleLayerCompare(layer);
    }

    this.setState((state) => getUpdatedActiveLayersState(state, layer));
  }

  render () {
    const { spotlight } = this.props;

    if (spotlight.hasError()) return <UhOh />;

    const spotlightData = spotlight.getData();
    const layers = this.getLayersWithState();
    const activeTimeseriesLayers = this.getActiveTimeseriesLayers();

    // Check if there's any layer that's comparing.
    const comparingLayer = find(layers, 'comparing');
    const isComparing = !!comparingLayer;

    const mapLabel = get(comparingLayer, 'compare.mapLabel');
    const compareMessage = isComparing && mapLabel
      ? typeof mapLabel === 'function' ? mapLabel(this.state.timelineDate) : mapLabel
      : '';

    return (
      <App>
        <Inpage isMapCentric>
          <InpageHeader>
            <InpageHeaderInner>
              <InpageHeadline>
                <InpageTitle>Map</InpageTitle>
              </InpageHeadline>
            </InpageHeaderInner>
          </InpageHeader>
          {spotlight.isReady() && (
            <InpageBody>
              <ExploreCanvas>
                <PrimePanel
                  collapsible
                  direction='left'
                  onPanelChange={this.resizeMap}
                  headerContent={
                    <PanelHeadline>
                      <h2>{spotlightData.label}</h2>
                    </PanelHeadline>
                  }
                  bodyContent={
                    <DataLayersBlock
                      layers={layers}
                      mapLoaded={this.state.mapLoaded}
                      onAction={this.onPanelAction}
                    />
                  }
                />
                <ExploreCarto>
                  <MapMessage active={isComparing && !!compareMessage}>
                    <p>{compareMessage}</p>
                  </MapMessage>
                  <MbMap
                    ref={this.mbMapRef}
                    onAction={this.onMapAction}
                    layers={layers}
                    activeLayers={this.state.activeLayers}
                    date={this.state.timelineDate}
                    aoiState={null}
                    comparing={isComparing}
                  />
                  <Timeline
                    isActive={!!activeTimeseriesLayers.length}
                    layers={activeTimeseriesLayers}
                    date={this.state.timelineDate}
                    onAction={this.onPanelAction}
                    onSizeChange={this.resizeMap}
                  />
                </ExploreCarto>
                <SecPanel
                  collapsible
                  direction='right'
                  onPanelChange={this.resizeMap}
                  headerContent={
                    <PanelHeadline>
                      <PanelTitle>Insights</PanelTitle>
                    </PanelHeadline>
                  }
                  bodyContent={
                    <BodyScroll>
                      <PanelBodyInner>
                        {spotlightData.indicators.length ? spotlightData.indicators.map(ind => {
                          const xDomain = ind.domain.date.map(utcDate);
                          const yDomain = ind.domain.indicator;

                          return (
                            <React.Fragment key={ind.id}>
                              <h2>{ind.name}</h2>
                              {ind.description && <p>{ind.description}</p>}
                              <LineChart
                                xDomain={xDomain}
                                yDomain={yDomain}
                                data={ind.data}
                                yUnit={ind.units}
                                selectedDate={!!activeTimeseriesLayers.length && this.state.timelineDate}
                                highlightBands={ind.highlightBands && ind.highlightBands.length ? ind.highlightBands : null}
                                noBaseline={ind.data[0].baseline === undefined}
                                noBaselineConfidence
                                noIndicatorConfidence
                              />
                            </React.Fragment>
                          );
                        }) : (
                          <p>Detailed information for the area being viewed and/or interacted by the user.</p>
                        )}
                      </PanelBodyInner>
                    </BodyScroll>
                  }
                />
              </ExploreCanvas>
            </InpageBody>
          )}
        </Inpage>
      </App>
    );
  }
}

SpotlightAreasSingle.propTypes = {
  fetchSpotlightSingle: T.func,
  mapLayers: T.array,
  spotlight: T.object,
  match: T.object
};

function mapStateToProps (state, props) {
  const { spotlightId } = props.match.params;
  const layersToUse = layersBySpotlight[spotlightId] || [];
  return {
    mapLayers: allMapLayers.filter(l => layersToUse.includes(l.id)),
    spotlight: wrapApiResult(getFromState(state, ['spotlight', 'single', spotlightId]))
  };
}

const mapDispatchToProps = {
  fetchSpotlightSingle: fetchSpotlightSingleAction
};

export default connect(mapStateToProps, mapDispatchToProps)(SpotlightAreasSingle);
