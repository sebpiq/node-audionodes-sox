var assert = require('assert')
  , _ = require('underscore')
  , async = require('async')
  , AudioBuffer = require('audiobuffer')
  , SoxEffect = require('../lib/SoxEffect')

describe('SoxEffect', function() {

  describe('_tick', function() {

    var helpers = require('./helpers')({approx: 0.001})

    var dummyContext = {sampleRate: 44100, BLOCK_SIZE: 128}

    it('should open a mono file and apply the effect on it', function(done) {
      var soxEffect = new SoxEffect(dummyContext, __dirname + '/sounds/steps-16b-44khz-mono.wav', 'gain', 13.97847)
        , blocks = [], block
        , allAudio, sliced
        , ended = false

      soxEffect.on('ready', function() {
        assert.deepEqual(soxEffect.format, {
          numberOfChannels: 1,
          bitDepth: 16,
          sampleRate: 44100,
          endianness: 'LE', signed: true
        })

        soxEffect.on('end', function() {
          ended = true
          // Concatenate all the blocks in one 
          allAudio = _.reduce(blocks, function(all, block) {
            return all.concat(block)
          }, new AudioBuffer(1, 0, 44100))
          // Test that we got teh expected values
          _.range(21).forEach(function(i) {
            sliced = allAudio.slice(i * 4410, (i + 1) * 4410)
            helpers.assertAllValuesApprox(sliced.getChannelData(0), -1 + i * 0.1)
          })
          done()
        })

        var audioTick = function() {
          block = soxEffect._tick()
          assert.equal(block.numberOfChannels, 1)
          assert.equal(block.length, 128)
          assert.equal(block.sampleRate, 44100)
          blocks.push(block)
          if (!ended) setTimeout(audioTick, 128/44100)
        }
        audioTick()

      })

    })

    it('should open a stereo file and apply the effect on it', function(done) {
      var soxEffect = new SoxEffect(dummyContext, __dirname + '/sounds/steps-16b-44khz-stereo.wav', 'gain', 13.97847)
        , blocks = [], block
        , allAudio, sliced
        , ended = false

      soxEffect.on('ready', function() {
        assert.deepEqual(soxEffect.format, {
          numberOfChannels: 2,
          bitDepth: 16,
          sampleRate: 44100,
          endianness: 'LE', signed: true
        })

        soxEffect.on('end', function() {
          ended = true
          // Concatenate all the blocks in one 
          allAudio = _.reduce(blocks, function(all, block) {
            return all.concat(block)
          }, new AudioBuffer(2, 0, 44100))
          // Test that we got teh expected values
          _.range(21).forEach(function(i) {
            sliced = allAudio.slice(i * 4410, (i + 1) * 4410)
            helpers.assertAllValuesApprox(sliced.getChannelData(0), -1 + i * 0.1)
            helpers.assertAllValuesApprox(sliced.getChannelData(1), 1 - i * 0.1)
          })
          done()
        })

        var audioTick = function() {
          block = soxEffect._tick()
          assert.equal(block.numberOfChannels, 2)
          assert.equal(block.length, 128)
          assert.equal(block.sampleRate, 44100)
          blocks.push(block)
          if (!ended) setTimeout(audioTick, 128/44100)
        }
        audioTick()

      })

    })

    it('should return an error if the file doesn\'t exist', function(done) {
      var soxEffect = new SoxEffect(dummyContext, '/sounds/unknown.wav', 'gain', 13.97847)
      soxEffect.on('error', function(err) {
        assert.ok(err)
        done()
      })
    })

    it('should return an error if invalid arguments to sox', function(done) {
      var soxEffect = new SoxEffect(dummyContext,  __dirname + '/sounds/steps-16b-44khz-stereo.wav', 'blablabla')
      soxEffect.on('error', function(err) {
        assert.ok(err)
        done()
      })
    })

  })

})