#!/usr/bin/env node
var path = require('path')
var nopt = require('nopt')
var noptUsage = require('nopt-usage')
var shelljs = require('shelljs')
var fs = require('fs')
var configLib = require(path.join(__dirname, '../lib/config.js'))
var request = require('request')
var tar = require('tar')
var StreamZip = require('node-stream-zip')
var zlib = require('zlib')
var dir = require('node-dir')
var pointer = require('json-pointer')

let suiteRoot = configLib.findRootDirectoryPath(process.cwd(), '.wu')
let wuTmpDirPath = path.join(suiteRoot, '.wu', 'tmp')
let typeRegex = '(benchmark|compiler|environment|experiment|implementation)'
let fileNameRegex = typeRegex + '.json$'

var registry = {
  'backprop': '/Users/erick/Documents/Recherche/backprop-benchmark.zip',
  'c-commons': '/Users/erick/Documents/Recherche/ostrich-c-implementation-common.zip'
}

function Installer (options) {
  options = options || {verbose: false}

  function whenVerbose (m) {
    if (options.verbose) {
      console.log(m)
    }
  }

  function parse (id) {
    whenVerbose('parse(' + id + ')')

    if (id.match('^git')) {
      return {
        type: 'git',
        value: id.replace('://', '@')
      }
    } else if (id.match('^(' +
        Object.keys(registry)
          .join('|') +
        ')')) {
      return {
        type: 'short-name',
        value: id
      }
    } else if (id.match('^http(s)?:')) {
      return {
        type: 'url',
        value: id
      }
    } else if (!fs.accessSync(id)) {
      var stat = fs.statSync(id)
      if (stat.isFile()) {
        let source = path.resolve(process.cwd(), path.dirname(id))
        if (source.indexOf(suiteRoot) > -1 && id.match(fileNameRegex)) {
          return {
            type: 'directory',
            value: source
          }
        } else {
          return {
            type: 'file',
            value: path.join(source, id)
          }
        }
      } else if (stat.isDirectory()) {
        return {
          type: 'directory',
          value: path.resolve(process.cwd(), id)
        }
      } else {
        throw new Error('Invalid id ' + id)
      }
    } else {
      throw new Error('Invalid id ' + id)
    }
  }

  function extractArchive (filePath) {
    var dirPath = path.dirname(filePath)

    return new Promise(function (resolve, reject) {
      function done () {
        whenVerbose('Extracted archive ' + filePath + '\n to ' + dirPath)
        whenVerbose('Deleting archive ' + filePath)
        shelljs.rm(filePath)
        resolve(dirPath)
      }

      if (filePath.match('\.zip')) {
        var zip = new StreamZip({
          file: filePath
        })
          .on('error', reject)
          .on('ready', () => {
            zip.extract(null, dirPath, (err, count) => {
              if (err) {
                reject(err)
              } else {
                console.log('WARNING: executable permission are not set by the current zip extractor, you may need to set them manually')
                done()
              }
            })
          })
      } else if (filePath.match('\.tar')) {
        fs
          .createReadStream(filePath)
          .on('error', reject)
          .pipe(zlib.Unzip())
          .on('error', reject)
          .pipe(tar.Extract({ path: dirPath }))
          .on('error', reject)
          .on('end', done)
      } else {
        whenVerbose('Not a known archive, skipping extraction')
        resolve(dirPath)
      }
    })
  }

  function fetchFile (filePath, dest) {
    dest = dest || path.join(wuTmpDirPath, configLib.computeDirectoryName(filePath))
    var destPath = path.join(dest, path.basename(filePath))
    shelljs.mkdir('-p', dest)

    return new Promise(function (resolve, reject) {
      fs
        .createReadStream(filePath)
        .on('error', reject)
        .pipe(fs.createWriteStream(destPath))
        .on('close', () => {
          whenVerbose('Copied file from ' + filePath)
          extractArchive(destPath)
            .then(resolve, reject)
        })
        .on('error', reject)
    })
  }

  function fetchURL (url, dest) {
    dest = dest || path.join(wuTmpDirPath, configLib.computeDirectoryName(url))
    var destPath = path.join(dest, path.basename(url))
    shelljs.mkdir('-p', dest)

    return new Promise(function (resolve, reject) {
      var f = fs.createWriteStream(destPath)
      f.on('close', () => {
        whenVerbose('Downloaded file from url ' + url)
        extractArchive(destPath)
          .then(resolve, reject)
      })
      request(url, (err, res, body) => {
        if (err || !res || res.statusCode !== 200) {
          whenVerbose('fetchURL error ' + err)
          reject('Invalid url: ' + url)
        }
      }).pipe(f)
    })
  }

  function fetchGit (gitPath, dest) {
    dest = dest || path.join(wuTmpDirPath, configLib.computeDirectoryName(gitPath))
    shelljs.mkdir('-p', path.dirname(dest))
    return new Promise(function (resolve, reject) {
      shelljs
        .exec('git clone --recursive ' + gitPath + ' ' + dest, {silent: true}, (code, stdout, stderr) => {
          if (code !== 0) {
            reject(stdout + (stderr || ''))
          } else {
            whenVerbose(stdout)
            whenVerbose('Downloaded git repository from ' + gitPath)
            resolve(dest)
          }
        })
    })
  }

  function fetchRemote (dependency) {
    var source = dependency.source
    if (!source.type) {
      return Promise.reject(new Error('Invalid source ' + source))
    }

    var fetch
    if (source.type === 'url') {
      console.log('Fetching url ' + source.value)
      fetch = fetchURL(source.value)
    } else if (source.type === 'git') {
      console.log('Fetching git repository ' + source.value)
      fetch = fetchGit(source.value)
    } else if (source.type === 'file') {
      console.log('Fetching file ' + source.value)
      fetch = fetchFile(source.value)
    } else {
      return Promise.reject(new Error('Nothing to fetch for source.type ' + source.type))
    }

    return fetch.then((source) => {
      dependency.source = { 'file': source }
      return Promise.resolve(dependency)
    })
  }

  function findArtifactDescription (dir) {
    whenVerbose('findArtifactDescription(' + JSON.stringify(dir) + ')')
    return new Promise((resolve, reject) => {
      if (typeof dir !== 'string') {
        return reject(new Error('Invalid directory ' + JSON.stringify(dir)))
      }

      fs.readdir(dir, (err, files) => {
        if (err) {
          return reject(err)
        }

        let artifacts = files.filter((f) => f.match(fileNameRegex))
        let artifactPaths = artifacts.map((f) => path.join(dir, f))

        if (artifactPaths.length === 0) {
          whenVerbose('Found no artifact description')
          return resolve(null)
        } else if (artifactPaths.length > 1) {
          return reject(new Error('Multiple artifacts found ' + artifactPaths))
        } else {
          whenVerbose('Validating the artifact description at ' + artifactPaths[0])
          return configLib.validateDescription(artifactPaths[0], {verbose: options.verbose})
            .then((description) => {
              description.location = artifactPaths[0]
              return resolve(description)
            })
        }
      })
    })
  }

  function validate (dependency) {
    return new Promise((resolve, reject) => {
      whenVerbose('validate(' + JSON.stringify(dependency) + ')')
      if (!dependency.source) {
        return reject(new Error('Missing dependency source in ' + JSON.stringify(dependency)))
      }

      if (typeof dependency.destination === 'undefined' ||
        !dependency.hasOwnProperty('destination')) {
        return reject(new Error('Missing dependency destination'))
      }

      if (dependency.destination) {
        try {
          fs.accessSync(dependency.destination)
          return reject('Destination ' + dependency.destination + ' already exists ')
        } catch (err) {}
      }

      if (dependency.type !== 'file' && (!dependency['short-name'])) {
        return reject(new Error('Invalid artifact dependency, missing short-name ' + JSON.stringify(dependency)))
      }

      /*
      let source = path.resolve(process.cwd(), dependency.source)
      if (source.indexOf(suiteRoot) === -1 && !dependency.destination) {
        return reject(new Error('Invalid directory, the directory should be a subdirectory of a Wu-Wei repository'))
      }
      */

      whenVerbose('Dependency ready')
      return resolve(dependency)
    })
  }

  function autocomplete (dependency) {
    function processDescription (description) {
      if (description === null) {
        whenVerbose('No description found')
        if (!dependency.type) {
          dependency.type = 'file'
        }
        if (!dependency.hasOwnProperty('destination')) {
          dependency.destination = null
        }
      } else {
        whenVerbose('Dependency is an artifact')
        if (dependency.type && description.type !== dependency.type) {
          return Promise.reject(new Error('Inconsistent types between dependency ' + dependency.type + ' and description ' + description.type))
        } else {
          dependency.type = description.type
        }

        dependency.location = path.resolve(process.cwd(), path.dirname(description.location))

        dependency['short-name'] = dependency['short-name'] || description['short-name']
        description['short-name'] = dependency['short-name']

        let isWuWeiRepositorySubdir = dependency.source.file.indexOf(suiteRoot) !== -1
        let isWuTmpSubdir = dependency.source.file.indexOf(path.join(suiteRoot, '.wu')) !== -1

        if (isWuWeiRepositorySubdir && !isWuTmpSubdir) {
          // We do not duplicate artifacts within the repository
          dependency.destination = null
        } else {
          // We import artifacts from elsewhere into the repository
          // by copying them
          dependency.destination = dependency.destination || {'file': path.join(suiteRoot, description.type + 's', dependency['short-name'])}
        }

        if (description.dependencies) {
          dependency.dependencies = description.dependencies
        }
      }

      whenVerbose('Dependency:')
      whenVerbose(dependency)

      whenVerbose('Resolving paths')
      configLib.resolvePaths(dependency)
      configLib.expand(dependency)

      whenVerbose('Dependency:')
      whenVerbose(dependency)

      return Promise.resolve(dependency)
    }

    whenVerbose('autocomplete(' + JSON.stringify(dependency) + ')')
    if (!dependency.source) {
      return Promise.reject(new Error('Missing dependency source in ' + JSON.stringify(dependency)))
    }

    let source = dependency.source.file
    let files = fs.readdirSync(source)
    whenVerbose('     source content: ' + files)
    if (files.length === 1) {
      let file = path.resolve(source, files[0])
      if (fs.statSync(file).isDirectory() && file.match('.wu')) {
        source = file
      }
    }

    return findArtifactDescription(source)
      .then(processDescription)
      .then(validate)
  }

  function fetch (dependency) {
    whenVerbose('fetch(' + JSON.stringify(dependency) + ')')

    if (typeof dependency === 'string') {
      dependency = {
        source: dependency
      }
    } else if (Object.prototype.isPrototypeOf(dependency)) {
      if (!dependency.source) {
        throw new Error('fetch: No dependency source provided in ' + JSON.stringify(dependency))
      }
    } else {
      throw new Error('fetch: Invalid argument ' + dependency + ', expected a string or an object')
    }

    try {
      var parsed = parse(dependency.source)
    } catch (e) {
      return Promise.reject(new Error('fetch: Invalid source ' + dependency.source + '\n' + e))
    }

    dependency.source = parsed

    whenVerbose('fetch before cases:' + JSON.stringify(dependency))
    if (parsed.type === 'url' ||
      parsed.type === 'git' ||
      parsed.type === 'file') {
      return fetchRemote(dependency)
        .then(autocomplete)
    } else if (parsed.type === 'short-name') {
      dependency.source = registry[parsed.value]
      return fetch(dependency)
    } else if (parsed.type === 'directory') {
      dependency.source = { 'file': parsed.value }
      return Promise.resolve(dependency)
        .then(autocomplete)
    } else {
      throw new Error('Invalid parse type ' + parsed.type)
    }
  }

  return {fetch: fetch}
}
exports.Installer = Installer
{
let i = new Installer()
exports.fetch = i.fetch
}
