import document from 'global/document';

import QUnit from 'qunit';
import sinon from 'sinon';
import videojs from 'video.js';

import plugin from '../src/plugin';

const Player = videojs.getComponent('Player');

// This is for cross-compatibility between Video.js 5 and 6.
const dom = videojs.dom || videojs;

QUnit.test('the environment is sane', function(assert) {
  assert.strictEqual(typeof Array.isArray, 'function', 'es5 exists');
  assert.strictEqual(typeof sinon, 'object', 'sinon exists');
  assert.strictEqual(typeof videojs, 'function', 'videojs exists');
  assert.strictEqual(typeof plugin, 'function', 'plugin is a function');
});

QUnit.module('videojs-overlay', {

  beforeEach() {

    // Mock the environment's timers because certain things - particularly
    // player readiness - are asynchronous in video.js 5. This MUST come
    // before any player is created; otherwise, timers could get created
    // with the actual timer methods!
    this.clock = sinon.useFakeTimers();

    this.fixture = document.getElementById('qunit-fixture');
    this.video = document.createElement('video');
    this.fixture.appendChild(this.video);
    this.player = videojs(this.video);

    // Simulate the video element playing to a specific time and stub
    // the `currentTime` method of the player to return this.
    this.currentTime = 0;

    this.player.currentTime = () => this.currentTime;

    this.updateTime = seconds => {
      this.currentTime = seconds;
      this.player.trigger('timeupdate');
    };

    this.assertOverlayCount = (assert, expected) => {
      let overlays = Array.prototype.filter.call(
        this.player.$$('.vjs-overlay'),
        el => !dom.hasClass(el, 'vjs-hidden')
      );
      let actual = overlays ? overlays.length : 0;
      let one = expected === 1;
      let msg = `${expected} overlay${one ? '' : 's'} exist${one ? 's' : ''}`;

      assert.strictEqual(actual, expected, msg);
    };
  },

  afterEach() {
    this.player.dispose();
    this.clock.restore();
  }
});

QUnit.test('registers itself with video.js', function(assert) {
  assert.expect(2);

  assert.strictEqual(
    typeof Player.prototype.overlay,
    'function',
    'videojs-overlay plugin was registered'
  );

  assert.ok(videojs.getComponent('Overlay'), 'the Overlay component was registered');
});

QUnit.test('does not display overlays when none are configured', function(assert) {
  assert.expect(1);

  this.player.overlay({
    overlays: []
  });

  this.assertOverlayCount(assert, 0);
});

QUnit.test('can be triggered and dismissed by events', function(assert) {
  assert.expect(3);

  this.player.overlay({
    overlays: [{
      start: 'custom-start',
      end: 'custom-end'
    }]
  });

  this.assertOverlayCount(assert, 0);

  this.player.trigger('custom-start');
  this.assertOverlayCount(assert, 1);

  this.player.trigger('custom-end');
  this.assertOverlayCount(assert, 0);
});

QUnit.test('can be triggered for time intervals', function(assert) {
  assert.expect(7);

  this.player.overlay({
    overlays: [{
      start: 5,
      end: 10
    }]
  });

  this.updateTime(4);
  this.assertOverlayCount(assert, 0);

  this.updateTime(5);
  this.assertOverlayCount(assert, 1);

  this.updateTime(7.5);
  this.assertOverlayCount(assert, 1);

  this.updateTime(10);
  this.assertOverlayCount(assert, 0);

  this.updateTime(11);
  this.assertOverlayCount(assert, 0);

  this.updateTime(6);
  this.assertOverlayCount(assert, 1);

  this.updateTime(12);
  this.assertOverlayCount(assert, 0);
});

QUnit.test('shows multiple overlays simultaneously', function(assert) {
  assert.expect(4);

  this.player.overlay({
    overlays: [{
      start: 3,
      end: 10
    }, {
      start: 'playing',
      end: 'ended'
    }]
  });

  this.updateTime(4);
  this.assertOverlayCount(assert, 1);

  this.player.trigger('playing');
  this.assertOverlayCount(assert, 2);

  this.player.trigger('ended');
  this.assertOverlayCount(assert, 1);

  this.updateTime(11);
  this.assertOverlayCount(assert, 0);
});

QUnit.test(
  'the content of overlays can be specified as an HTML string',
  function(assert) {
    assert.expect(1);

    let innerHTML = '<p>overlay <a href="#">text</a></p>';

    this.player.overlay({
      content: innerHTML,
      overlays: [{
        start: 'playing',
        end: 'ended'
      }]
    });

    this.player.trigger('playing');

    assert.strictEqual(
      this.player.$('.vjs-overlay').innerHTML,
      innerHTML,
      'innerHTML matched'
    );
  }
);

QUnit.test('an element can be used as the content of overlays', function(assert) {
  assert.expect(1);

  let content = document.createElement('p');

  content.innerHTML = 'this is some text';

  this.player.overlay({
    content,
    overlays: [{
      start: 5,
      end: 10
    }]
  });

  this.updateTime(5);

  assert.strictEqual(
    this.player.$('.vjs-overlay p'),
    content,
    'sets the content element'
  );
});

QUnit.test('a DocumentFragment can be used as the content of overlays', function(assert) {
  assert.expect(1);

  let fragment = document.createDocumentFragment();
  let br = document.createElement('br');

  fragment.appendChild(br);

  this.player.overlay({
    content: fragment,
    overlays: [{
      start: 'showoverlay',
      end: 'hideoverlay'
    }]
  });

  this.player.trigger('showoverlay');

  assert.strictEqual(
    this.player.$('.vjs-overlay br'),
    br,
    'sets the content fragment'
  );
});

QUnit.test('allows content to be specified per overlay', function(assert) {
  assert.expect(5);

  let text = '<b>some text</b>';
  let html = '<p>overlay <a href="#">text</a></p>';
  let element = document.createElement('i');
  let fragment = document.createDocumentFragment();

  fragment.appendChild(document.createElement('img'));

  this.player.overlay({
    content: text,
    overlays: [{
      start: 0,
      end: 1
    }, {
      content: html,
      start: 0,
      end: 1
    }, {
      content: element,
      start: 0,
      end: 1
    }, {
      content: fragment,
      start: 0,
      end: 1
    }]
  });

  this.updateTime(0);
  this.assertOverlayCount(assert, 4);

  assert.strictEqual(
    this.player.$$('.vjs-overlay b').length,
    1,
    'shows a default overlay'
  );

  assert.strictEqual(
    this.player.$$('.vjs-overlay p').length,
    1,
    'shows an HTML string'
  );

  assert.strictEqual(
    this.player.$$('.vjs-overlay i').length,
    1,
    'shows a DOM element'
  );

  assert.strictEqual(
    this.player.$$('.vjs-overlay img').length,
    1,
    'shows a document fragment'
  );
});

QUnit.test('allows css class to be specified per overlay', function(assert) {
  assert.expect(3);

  let text = '<b>some text</b>';
  let fragment = document.createDocumentFragment();

  fragment.appendChild(document.createElement('img'));

  this.player.overlay({
    content: text,
    overlays: [{
      class: 'first-class-overlay',
      start: 0,
      end: 1
    }, {
      class: 'second-class-overlay',
      start: 0,
      end: 1
    }, {
      start: 0,
      end: 1
    }]
  });

  this.updateTime(0);

  this.assertOverlayCount(assert, 3);

  assert.strictEqual(
    this.player.$$('.first-class-overlay').length,
    1,
    'shows an overlay with a custom class'
  );

  assert.strictEqual(
    this.player.$$('.second-class-overlay').length,
    1,
    'shows an overlay with a different custom class'
  );
});

QUnit.test('does not double add overlays that are triggered twice', function(assert) {
  assert.expect(1);

  this.player.overlay({
    overlays: [{
      start: 'start',
      end: 'end'
    }]
  });

  this.player.trigger('start');
  this.player.trigger('start');
  this.assertOverlayCount(assert, 1);
});

QUnit.test('does not double remove overlays that are triggered twice', function(assert) {
  assert.expect(1);

  this.player.overlay({
    overlays: [{
      start: 'start',
      end: 'end'
    }]
  });

  this.player.trigger('start');
  this.player.trigger('end');
  this.player.trigger('end');
  this.assertOverlayCount(assert, 0);
});

QUnit.test(
  'displays overlays that mix event and playback time triggers',
  function(assert) {
    assert.expect(4);

    this.player.overlay({
      overlays: [{
        start: 'start',
        end: 10
      }, {
        start: 5,
        end: 'end'
      }]
    });

    this.player.trigger('start');
    this.assertOverlayCount(assert, 1);

    this.updateTime(6);
    this.assertOverlayCount(assert, 2);

    this.updateTime(10);
    this.assertOverlayCount(assert, 1);

    this.player.trigger('end');
    this.assertOverlayCount(assert, 0);
  }
);

QUnit.test('shows mixed trigger overlays once per seek', function(assert) {
  assert.expect(6);

  this.player.overlay({
    overlays: [{
      start: 1,
      end: 'pause'
    }]
  });

  this.updateTime(1);
  this.assertOverlayCount(assert, 1);

  this.player.trigger('pause');
  this.assertOverlayCount(assert, 0);

  this.updateTime(2);
  this.assertOverlayCount(assert, 0);

  this.updateTime(1);
  this.assertOverlayCount(assert, 1);

  this.player.trigger('pause');
  this.assertOverlayCount(assert, 0);

  this.updateTime(2);
  this.assertOverlayCount(assert, 0);
});

QUnit.test('applies simple alignment class names', function(assert) {
  assert.expect(4);

  this.player.overlay({
    overlays: [{
      start: 'start',
      align: 'top'
    }, {
      start: 'start',
      align: 'left'
    }, {
      start: 'start',
      align: 'right'
    }, {
      start: 'start',
      align: 'bottom'
    }]
  });

  this.player.trigger('start');

  assert.ok(
    this.player.$('.vjs-overlay.vjs-overlay-top'),
    'applies top class'
  );

  assert.ok(
    this.player.$('.vjs-overlay.vjs-overlay-right'),
    'applies right class'
  );

  assert.ok(
    this.player.$('.vjs-overlay.vjs-overlay-bottom'),
    'applies bottom class'
  );

  assert.ok(
    this.player.$('.vjs-overlay.vjs-overlay-left'),
    'applies left class'
  );
});

QUnit.test('applies compound alignment class names', function(assert) {
  assert.expect(4);

  this.player.overlay({
    overlays: [{
      start: 'start',
      align: 'top-left'
    }, {
      start: 'start',
      align: 'top-right'
    }, {
      start: 'start',
      align: 'bottom-left'
    }, {
      start: 'start',
      align: 'bottom-right'
    }]
  });

  this.player.trigger('start');

  assert.ok(
    this.player.$('.vjs-overlay.vjs-overlay-top-left'),
    'applies top class'
  );

  assert.ok(
    this.player.$('.vjs-overlay.vjs-overlay-top-right'),
    'applies right class'
  );

  assert.ok(
    this.player.$('.vjs-overlay.vjs-overlay-bottom-left'),
    'applies bottom class'
  );

  assert.ok(
    this.player.$('.vjs-overlay.vjs-overlay-bottom-right'),
    'applies left class'
  );
});

QUnit.test('removes time based overlays if the user seeks backward', function(assert) {
  assert.expect(2);

  this.player.overlay({
    overlays: [{
      start: 5,
      end: 10
    }]
  });

  this.updateTime(6);
  this.assertOverlayCount(assert, 1);

  this.updateTime(4);
  this.assertOverlayCount(assert, 0);
});

QUnit.test('applies background styling when showBackground is true', function(assert) {
  assert.expect(1);

  this.player.overlay({
    overlays: [{
      start: 'start',
      showBackground: true
    }]
  });

  this.player.trigger('start');

  assert.ok(
    this.player.$('.vjs-overlay.vjs-overlay-background'),
    'applies background styling'
  );
});

QUnit.test('doesn\'t apply background when showBackground is false', function(assert) {
  assert.expect(1);

  this.player.overlay({
    overlays: [{
      start: 'start',
      showBackground: false
    }]
  });

  this.player.trigger('start');

  assert.notOk(
    this.player.$('.vjs-overlay.vjs-overlay-background'),
    'does not apply background styling'
  );
});

QUnit.test('attaches bottom aligned overlays to the controlBar', function(assert) {
  assert.expect(4);

  this.player.overlay({
    attachToControlBar: true,
    overlays: [{
      start: 'start',
      align: 'bottom-left'
    }, {
      start: 'start',
      align: 'bottom'
    }, {
      start: 'start',
      align: 'bottom-right'
    }, {
      start: 'start',
      align: 'top-right'
    }]
  });

  this.player.trigger('start');

  assert.ok(
    this.player.controlBar.$('.vjs-overlay.vjs-overlay-bottom-left'),
    'bottom-left attaches to control bar'
  );

  assert.ok(
    this.player.controlBar.$('.vjs-overlay.vjs-overlay-bottom'),
    'bottom attaches to control bar'
  );

  assert.ok(
    this.player.controlBar.$('.vjs-overlay.vjs-overlay-bottom-right'),
    'bottom-right attaches to control bar'
  );

  assert.notOk(
    this.player.controlBar.$('.vjs-overlay.vjs-overlay-top-right'),
    'top-right is not attached to control bar'
  );
});

QUnit.test('attach only to player when attachToControlbar is false', function(assert) {
  assert.expect(2);

  this.player.overlay({
    attachToControlBar: false,
    overlays: [{
      start: 'start',
      align: 'bottom-left'
    }, {
      start: 'start',
      align: 'bottom'
    }]
  });

  assert.notOk(
    this.player.controlBar.$('.vjs-overlay.vjs-overlay-bottom-left'),
    'bottom-left is not attached to control bar'
  );

  assert.notOk(
    this.player.controlBar.$('.vjs-overlay.vjs-overlay-bottom'),
    'bottom is not attached to control bar'
  );
});

QUnit.test('can deinitialize the plugin on reinitialization', function(assert) {
  assert.expect(3);

  this.player.overlay({
    attachToControlBar: true,
    overlays: [{
      start: 'start',
      align: 'bottom-left'
    }, {
      start: 'start',
      align: 'top-right'
    }]
  });

  this.player.overlay({
    overlays: [{
      start: 'start',
      align: 'top-left'
    }]
  });

  assert.notOk(
    this.player.$('.vjs-overlay.vjs-overlay-bottom-left'),
    'previous bottom-left aligned overlay removed'
  );

  assert.notOk(
    this.player.$('.vjs-overlay.vjs-overlay-top-right'),
    'previous top-right aligned overlay removed'
  );

  assert.ok(
    this.player.$('.vjs-overlay.vjs-overlay-top-left'),
    'new top-left overlay added'
  );
});
