var path = require('path')
var configLib = require('./config.js')
var debug = require('debug')
var log = debug('wu-wei-benchmarking-toolkit:api')

function defaults (options) {
  options = options || {}
  options.benchmarks = options.benchmarks || []
  options.compilers = options.compilers || []
  options.implementations = options.implementations || []
  options.clean = options.clean || false
  options.experiment = options.experiment || {
    'short-name': 'default',
    'input-size': 'medium'
  }
  options.experiment.type = 'experiment'
  options.experiment['short-name'] = options.experiment['short-name'] || 'default'
  options.experiment['input-size'] = options.experiment['input-size'] || 'medium'
  options.verbose = options.verbose || false

  var hiddenDirName = '.wu'
  options.suiteRoot = options.suiteRoot ? path.resolve(process.cwd(), options.suiteRoot) : configLib.findRootDirectoryPath(process.cwd(), hiddenDirName)
  options.root = options.suiteRoot

  return options
}

function build (options, cb) {
  options = defaults(options)
  log(options)
  configLib.config(options.suiteRoot, function (err, config) {
    if (err) {
      cb(err)
    }

    try {
      var configs = configLib.genBuildConfigurations(config, options).map(function (config) {
        return configLib.createRunner(config, options)
      })
      cb(null, configs)
    } catch (err) {
      cb(err)
    }
  })
}

function init (path, cb) {
  throw new Error('Unimplemented init')
}

function install (sources, cb) {
  throw new Error('Unimplemented install')
}

function list (options, cb) {
  options = defaults(options)
  throw new Error('Unimplemented list')
}

function platform (cb) {
  throw new Error('Unimplemented platform')
}

function report (options, cb) {
  options = defaults(options)
  throw new Error('Unimplemented report')
}

function run (options, cb) {
  options = defaults(options)
  throw new Error('Unimplemented run')
}

module.exports = {
  build: build,
  init: init,
  install: install,
  list: list,
  platform,
  report: report,
  run: run
}
