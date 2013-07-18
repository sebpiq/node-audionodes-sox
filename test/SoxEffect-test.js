var assert = require('assert')
  , async = require('async')
  , _ = require('underscore')
  , AudioBuffer = require('audiobuffer')
  , SoxEffect = require('../lib/SoxEffect')

describe('SoxEffect', function() {

  describe('pullAudio', function() {

    var helpers = require('./helpers')({approx: 0.00001})

    var dummyContext = {sampleRate: 44100, BLOCK_SIZE: 128}

    it('should open a sound file and apply the effect on it', function(done) {
      var soxEffect = new SoxEffect(dummyContext, __dirname + '/sounds/steps-16b-44khz-mono.wav', 'gain', 13.97847)
        , buffers = []
        , allAudio
        , chArray
      async.whilst(
        function() { return soxEffect._returnCode === null },
        function(next) {
          soxEffect.pullAudio(function(err, buffer) {
            assert.ok(!err)
            assert.equal(buffer.length, 128)
            assert.equal(buffer.numberOfChannels, 1)
            assert.equal(buffer.sampleRate, 44100)
            buffers.push(buffer)
            next()
          })
        },
        function() {
          // Concatenate all the buffers in one 
          allAudio = _.reduce(buffers, function(all, buffer) {
            return all.concat(buffer)
          }, new AudioBuffer(1, 0, 44100))

          // Test that we got teh expected values
          debugger
          _.range(21).forEach(function(i) {
            chArray = allAudio.slice(i * 4410, (i + 1) * 4410)
            helpers.assertAllValuesApprox(chArray, -1 + i * 0.3)
          })
          done()
        }
      )
    })

    /*it('should return an error if the file doesn\'t exist', function(done) {
      var soxEffect = new SoxEffect(__dirname + '/sounds/unknown.wav', 'gain', 13.97847)
      soxEffect.pullAudio(function(err, buffer) {
        assert.ok(err)
        assert.ok(!buffer)
        done()
      })
    })*/

  })

})