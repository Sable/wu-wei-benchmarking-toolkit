#!/usr/bin/env node
var test = require('unit.js')
var assert = require('assert')
var path = require('path')
var shelljs = require('shelljs')
var fs = require('fs')
var exec = require('child_process').exec

var wuPath = path.join(__dirname, '..', 'bin', 'wu')
function wu (cmd) {
  var wuCmd = wuPath + ' ' + cmd
  var status = shelljs.exec(wuCmd)
  if (status.code !== 0) {
    throw new Error('Error while executing ' + wuCmd + ', obtained status ' + status.code + ' and error output' + status.stderr)
  } else {
    return status
  }
}
var testRoot = path.resolve(process.cwd(), __dirname)

describe('Wu-Wei Tests', function () {
  var rootTmp
  var tmp
  var options = ''
  var server

  before('Setup root directory', function () {
    rootTmp = path.resolve(process.cwd(), fs.mkdtempSync('./fetch-tests'))
    shelljs.cd(rootTmp)
    server = exec('node ' +
      path.join(testRoot, '..', 'utilities', 'file-server.js') +
      ' ' + path.join(testRoot, 'public'), (error, stdout, stderr) => {
        if (error) {
          console.log(error)
          process.exit(1)
        } else {
          done
        }
      })

  })

  after('Cleanup root directory', function () {
    if (rootTmp) {
      shelljs.rm('-rf', rootTmp)
    }

    if (server) {
      server.kill()
    }
  })

  beforeEach('Setup test directory', function () {
    this.timeout(0);
    tmp = path.resolve(process.cwd(), fs.mkdtempSync(path.join(rootTmp, 'test')))
    shelljs.cd(tmp)
    wu('init')
  })

  afterEach(function () {
    // runs after each test in this block
  })

  it('Empty repository', function () {
    this.timeout(0)
    wu('install')
  })

  it('Fetch from a remote github repository', function () {
    this.timeout(0)
    wu('install https://github.com/Sable/ostrich-matlab-concatenate-compiler.git' + options)
    fs.accessSync(path.join(tmp, 'compilers', 'matlab-concat', 'compiler.json'))
  })

  it('Fetch artifact from a file archive on the file system', function () {
    this.timeout(0)
    wu('install ' + path.join(testRoot, 'public', 'ostrich-matlab-concatenate-compiler.zip') + ' ' + options)
    // Indeed the short-name has changed in the meantime but this zipped repo has not 
    // been kept up-to-date with the maintained repo so it is still using the 'none-matlab' name
    fs.accessSync(path.join(tmp, 'compilers', 'none-matlab', 'compiler.json'))
  })

  it('Initialize new implementation from template', function () {
    this.timeout(0)
    wu('install https://github.com/Sable/benchmark-template.git' + options)
    let destination = path.join(tmp, 'benchmarks', 'template', 'implementations', 'matlab-test')
    shelljs.mkdir('-p', path.dirname(destination))
    wu('install https://github.com/Sable/matlab-implementation-template.git ' +
      ' --destination ' + destination
      + options)
    let implementationDescription = path.join(destination, 'implementation.json')
    fs.accessSync(implementationDescription)
    let description = JSON.parse(fs.readFileSync(implementationDescription))
    if (description['short-name'] !== 'matlab-test') {
      throw new Error('Test error: unexpected short-name ' + description['short-name'])
    }
  })

  it('End-to-end test', function () {
    this.timeout(0)
    wu('install ' + path.join(testRoot, 'public', 'fib-experiment.json') + ' ' + options)
    fs.accessSync(path.join(tmp, 'compilers', 'gcc', 'compiler.json'))
    fs.accessSync(path.join(tmp, 'benchmarks', 'fib', 'benchmark.json'))
    fs.accessSync(path.join(tmp, 'benchmarks', 'fib', 'implementations', 'c', 'implementation.json'))
    fs.accessSync(path.join(tmp, 'environments', 'native', 'environment.json'))
    wu('platform --save --short-name test')
    wu('list')
    wu('run')
    wu('report')
  })
})
