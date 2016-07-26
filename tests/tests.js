#!/usr/bin/env node
var test = require('unit.js')
var assert = require('assert')
var path = require('path')
var shelljs = require('shelljs')
var fs = require('fs')
var exec = require('child_process').exec

function wu (cmd) {
  var wuCmd = 'wu ' + cmd
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
    tmp = path.resolve(process.cwd(), fs.mkdtempSync(path.join(rootTmp, 'test')))
    shelljs.cd(tmp)
    wu('init')
  })

  afterEach(function () {
    // runs after each test in this block
  })

  it('Empty repository', function () {
    wu('fetch')
  })

  it('Fetch from a remote github repository', function () {
    this.timeout(0)
    wu('fetch git@github.com:Sable/ostrich-matlab-concatenate-compiler.git' + options)
    fs.accessSync(path.join(tmp, 'compilers', 'none-matlab', 'compiler.json'))
  })

  it('Fetch artifact from a file archive on the file system', function () {
    this.timeout(0)
    wu('fetch ' + path.join(testRoot, 'public', 'ostrich-matlab-concatenate-compiler.zip') + ' ' + options)
    fs.accessSync(path.join(tmp, 'compilers', 'none-matlab', 'compiler.json'))
  })

  it('Fetch suite from a file archive', function () {
    this.timeout(0)
    wu('fetch ' + path.join(testRoot, 'public', 'test-suite.zip') + ' ' + options)
    fs.accessSync(path.join(tmp, 'compilers', 'none-matlab', 'compiler.json'))
  })

  it('Build test', function () {
    this.timeout(0)
    wu('fetch ' + path.join(testRoot, 'public', 'fib-suite.json') + ' ' + options)
    fs.accessSync(path.join(tmp, 'compilers', 'gcc', 'compiler.json'))
    fs.accessSync(path.join(tmp, 'benchmarks', 'fib', 'benchmark.json'))
    fs.accessSync(path.join(tmp, 'benchmarks', 'fib', 'implementations', 'c', 'implementation.json'))
    fs.accessSync(path.join(tmp, 'environments', 'native', 'environment.json'))
    wu('build -v ')
  })

  it('End-to-end test', function () {
    this.timeout(10000)
    wu('fetch ' + path.join(testRoot, 'public', 'fib-suite.json') + ' ' + options)
    fs.accessSync(path.join(tmp, 'compilers', 'gcc', 'compiler.json'))
    fs.accessSync(path.join(tmp, 'benchmarks', 'fib', 'benchmark.json'))
    fs.accessSync(path.join(tmp, 'benchmarks', 'fib', 'implementations', 'c', 'implementation.json'))
    fs.accessSync(path.join(tmp, 'environments', 'native', 'environment.json'))
    wu('platform --save --short-name test')
    wu('list')
    wu('run')
    wu('report')
  })

/* 
  // TODO: Add support for recursive dependencies
  it('Fetch benchmark from a file archive', function () {
    this.timeout(0)
    wu('fetch -v ' + path.join(testRoot, 'public', 'backprop-benchmark.zip') + ' ' + options)
    fs.accessSync(path.join(tmp, 'benchmarks', 'backprop', 'benchmark.json'))
    fs.accessSync(path.join(tmp, 'benchmarks', 'backprop', 'implementations', 'c', 'implementation.json'))
    fs.accessSync(path.join(tmp, 'benchmarks', 'backprop', 'implementations', 'c', 'common', 'common.h'))
  })
  */
})
