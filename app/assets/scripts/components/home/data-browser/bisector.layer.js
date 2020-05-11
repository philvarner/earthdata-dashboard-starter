import * as d3 from 'd3';
import { css } from 'styled-components';
import { startOfDay, add, getHours } from 'date-fns';

import { themeVal } from '../../../styles/utils/general';

const roundDate = date => {
  const h = getHours(date);
  return h >= 12
    ? startOfDay(add(date, { days: 1 }))
    : startOfDay(date);
};

const styles = props => css`
  /* Bisector specific styles */
  .bisector {
    &:hover {
      cursor: pointer;
    }
    .bisector-interact {
      stroke: ${themeVal('color.baseAlphaC')};
      stroke-width: 1px;
    }
    .bisector-select {
      stroke: #FFFFFF;
      stroke-width: 1px;
    }
  }
`;

export default {
  styles,
  init: ctx => {
    const bisectorG = ctx.dataCanvas
      .append('g')
      .attr('class', 'bisector');

    bisectorG.append('line')
      .attr('class', 'bisector-interact')
      .style('display', 'none');

    bisectorG.append('line')
      .attr('class', 'bisector-select');

    bisectorG.append('rect')
      .attr('class', 'trigger-rect')
      .style('fill', 'none')
      .style('pointer-events', 'all')
      .on('mouseover', function () {
        bisectorG.select('.bisector-interact').style('display', '');
      })
      .on('mouseout', function () {
        bisectorG.select('.bisector-interact').style('display', 'none');
      })
      .on('mousemove', function () {
        const xPos = d3.mouse(this)[0];
        const date = roundDate(ctx.xScale.invert(xPos));
        const xPosSnap = ctx.xScale(date);
        const { height } = ctx.getSize();
        bisectorG.select('.bisector-interact')
          .attr('y2', 0)
          .attr('y1', height)
          .attr('x1', xPosSnap)
          .attr('x2', xPosSnap);
      })
      .on('click', function () {
        const xPos = d3.mouse(this)[0];
        const date = roundDate(ctx.xScale.invert(xPos));
        ctx.props.onAction('date.set', { date });
      });
  },

  update: ctx => {
    const { selectedDate } = ctx.props;

    const { width, height } = ctx.getSize();

    ctx.dataCanvas
      .select('.bisector')
      .style('display', '')
      .raise()
      .select('.trigger-rect')
      .attr('width', width)
      .attr('height', height);

    const xPos = ctx.xScale(selectedDate);

    ctx.dataCanvas.select('.bisector-select')
      .attr('y2', 0)
      .attr('y1', height)
      .attr('x1', xPos)
      .attr('x2', xPos);
  }
};
