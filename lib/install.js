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
let wuDirPath = path.join(suiteRoot, '.wu')
let wuDependencyCacheListing = path.join(suiteRoot, '.wu', 'dependencies.json')
let wuDependencyCache = path.join(suiteRoot, '.wu', 'dependencies')
let typeRegex = '(benchmark|compiler|environment|experiment|implementation)'
let fileNameRegex = typeRegex + '.json$'

var registry = {
  'backprop': 'https://github.com/Sable/backprop-benchmark.git',
  'gcc': 'https://github.com/Sable/ostrich-gcc-compiler.git',
  'native': 'https://github.com/Sable/ostrich-native-environment.git'
}

function Installer (options) {
  options = options || {verbose: false}

  function whenVerbose (m) {
    if (options.verbose) {
      console.log(m)
    }
  }

  function exists (dependency) {
    if (dependency.destination) {
      try {
        fs.accessSync(dependency.destination)
        return true
      } catch (err) {}
      return false
    } else {
      return false
    }
  }

  function parse (id) {
    whenVerbose('parse(' + id + ')')

    if (id.match('^git') || id.match('\.git$')) {
      return {
        type: 'git',
        value: id
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
        // If it is an artifact within the repository, behave
        // as if install had been called with its directory instead
        if (source.indexOf(suiteRoot) > -1 && id.match(fileNameRegex)) {
          return {
            type: 'directory',
            value: source
          }
        } else {
          return {
            type: 'file',
            value: path.join(source, path.basename(id))
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
                console.log('WARNING: executable permissions are not set by the current zip extractor, you may need to set them manually')
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
        .exec('git clone ' + gitPath + ' ' + dest, {silent: true}, (code, stdout, stderr) => {
          if (code !== 0) {
            let message = String(stdout + (stderr || ''))
            return reject(new Error(message))
          } else {
            whenVerbose(stdout)
            whenVerbose('Downloaded git repository from ' + gitPath)
            return resolve(dest)
          }
        })
    })
  }

  function fetchDirectory (directoryPath, dest) {
    dest = dest || path.join(wuTmpDirPath, configLib.computeDirectoryName(directoryPath))
    shelljs.mkdir('-p', dest)

    return new Promise(function (resolve, reject) {
      fs.readdir(directoryPath, (err, files) => {
        if (err) {
          return reject(err)
        }

        let artifacts = files.filter((f) => f.match(fileNameRegex))
        let artifactPaths = artifacts.map((f) => path.join(directoryPath, f))

        if (artifactPaths.length === 0) {
          whenVerbose('Found no artifact description')
          return reject(new Error('No artifact found in remote directory ' + directoryPath))
        } else if (artifactPaths.length > 1) {
          return reject(new Error('Multiple artifacts found ' + artifactPaths))
        } else {
          shelljs.cp('-r', path.join(directoryPath, '*'), dest)
          whenVerbose('Copied directory content from ' + directoryPath)
          return resolve(dest)
        }
      })
    })
  }

  function fetchFromCache (dependency) {
    whenVerbose('fetchFromCache: ' + JSON.stringify(dependency))
    return new Promise((resolve, reject) => {
      let source = dependency.source
      if (!source.type) {
        return reject(new Error('Invalid source ' + source))
      }

      let dependencyListing = JSON.parse(fs.readFileSync(wuDependencyCacheListing).toString())
      if (dependencyListing.hasOwnProperty(dependency.source.value)) {
        whenVerbose('fetchFromCache: cached dependency found')
        let fetchedDependency = dependencyListing[dependency.source.value]
        if (dependency.hasOwnProperty('destination')) {
          fetchedDependency.destination = dependency.destination
        }
        return resolve(fetchedDependency)
      }

      whenVerbose('fetchFromCache: no cached dependency found')
      return resolve(dependency)
    })
  }

  function saveInCache (dependency) {
    return new Promise((resolve, reject) => {
      let dependencyListing = JSON.parse(fs.readFileSync(wuDependencyCacheListing).toString())
      if (!dependencyListing.hasOwnProperty(dependency.source.value) &&
        (dependency.source.type === 'url' ||
        dependency.source.type === 'git')) {
        if (!dependency.location) {
          return reject(new Error('saveInCache: No location in dependency ' + JSON.stringify(dependency)))
        }

        if (dependency.location.file.indexOf(wuTmpDirPath) === -1) {
          whenVerbose('saveInCache: Dependency located in ' + dependency.location + ' rather than in .wu/tmp folder, skipping')
          return resolve(dependency)
        }

        let cachedDependencyDirectory = path.join(suiteRoot,
          '.wu',
          'dependencies',
          dependency.source.type + '-' + configLib.computeDirectoryName(dependency.source.value))
        shelljs.cp('-r', dependency.location.file, cachedDependencyDirectory)

        let cachableDependency = {
          source: dependency.source,
          location: {'file': cachedDependencyDirectory}
        }
        dependencyListing[dependency.source.value] = cachableDependency
        fs.writeFileSync(wuDependencyCacheListing, JSON.stringify(dependencyListing, null, '  '))
        whenVerbose('saveInCache: Successfully cached ' + JSON.stringify(cachableDependency))
      }

      return resolve(dependency)
    })
  }

  function fetchRemote (dependency) {
    var source = dependency.source
    if (!source.type) {
      return Promise.reject(new Error('Invalid source ' + source))
    }

    // If the dependency has already been downloaded previously,
    // the location in the file system is set
    if (dependency.location) {
      return Promise.resolve(dependency)
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
    } else if (source.type === 'directory') {
      console.log('Fetching content from directory ' + source.value)
      fetch = fetchDirectory(source.value)
    } else {
      return Promise.reject(new Error('Nothing to fetch for source.type ' + source.type))
    }

    return fetch.then((location) => {
      dependency.location = { 'file': location }
      return Promise.resolve(dependency)
    })
  }

  function findArtifacts (directory, skipCurrentDir) {
    function keepValidSubDirs (paths) {
      return paths
        .filter((p) => fs.statSync(p).isDirectory())
        .filter((p) => {
          let basename = path.basename(p)
          let isHiddenDir = (basename.match('^\\..*$'))
          return !isHiddenDir
        })
    }

    return new Promise((resolve, reject) => {
      skipCurrentDir = skipCurrentDir || false
      whenVerbose('findArtifacts(' + directory + ')')
      fs.readdir(path.join(directory), (err, paths) => {
        if (err) {
          return reject(err)
        }
        paths = paths
          .map((p) => path.join(directory, p))

        let artifacts = paths
          .filter((p) => fs.statSync(p).isFile() && p.match(fileNameRegex))
        let subdirs = keepValidSubDirs(paths)

        if (!skipCurrentDir && artifacts.length === 1) {
          whenVerbose('findArtifacts: found artifact ' + artifacts[0])
          return resolve(artifacts)
        } else if (artifacts.length > 1) {
          return reject(new Error('Found multiple artifacts within directory ' + directory + ':\n' + artifacts.join('\n')))
        } else if (subdirs.length === 0) {
          whenVerbose('findArtifacts: no artifact and no subdirectories, stopping recursion in ' + directory)
          return resolve([])
        } else {
          whenVerbose('findArtifacts: did not find artifact, recursing in subdirectories ' + subdirs)
          return Promise.all(subdirs.map((d) => {
            return findArtifacts(d)
          }))
            .then((found) => {
              whenVerbose('findArtifacts: merging results ' + found + ' from subdirectories of ' + directory)
              return resolve(Array.prototype.concat.apply([], found))
            })
        }
      })
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
              whenVerbose('findArtifactDescription: artifact description valid')
              description.location = path.dirname(artifactPaths[0])
              description.filename = path.basename(artifactPaths[0])
              return resolve(description)
            }, reject)
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

      if (!dependency.location) {
        return reject(new Error('Missing dependency location in ' + JSON.stringify(dependency)))
      }

      if (typeof dependency.destination === 'undefined' ||
        !dependency.hasOwnProperty('destination')) {
        return reject(new Error('Missing dependency destination'))
      }

      if (dependency.type !== 'file' && (!dependency['short-name'])) {
        return reject(new Error('Invalid artifact dependency, missing short-name ' + JSON.stringify(dependency)))
      }

      let isWuTmpSubdir = dependency.location.indexOf(wuTmpDirPath) !== -1

      if (dependency.type === 'file' &&
        isWuTmpSubdir &&
        !dependency.destination) {
        return reject(new Error('No destination provided for remote non-artifact, aborting'))
      }

      if (dependency.type === 'implementation' &&
        dependency.destination &&
        path.basename(path.dirname(dependency.destination)) !== 'implementations') {
        let parentDirectory = path.dirname(dependency.destination)
        return reject(new Error("Invalid implementation destination's parent directory '" + parentDirectory + "', the parent directory should be 'implementations'"))
      }

      whenVerbose('Dependency ready')
      return resolve(dependency)
    })
  }

  function recurse (dependency) {
    function filterImplementationDependencies (dependency) {
      if (!dependency.dependencies) {
        return dependency
      }

      dependency.dependencies = dependency.dependencies.filter((d) => {
        if (options.implementations && d.type === 'implementation') {
          let keep = options.implementations.indexOf(d['short-name']) > -1
          if (!keep) {
            whenVerbose('recurse: skipping ' + d['short-name'] + ' implementation')
          }
          return keep
        } else {
          return true
        }
      })
      return dependency
    }

    return new Promise((resolve, reject) => {
      whenVerbose('recurse(' + JSON.stringify(dependency) + ')')
      dependency = configLib.deepcopy(dependency)
      let dependencies = dependency.dependencies || []

      whenVerbose('recurse: adding artifacts in sub-directories')
      return findArtifacts(dependency.location, true)
        .then((artifactPaths) => {
          if (artifactPaths.length > 0) {
            whenVerbose('recurse: added the following sub-directory dependencies ' + artifactPaths.join('\n'))
            dependencies = artifactPaths.concat(dependencies)
          }

          if (dependencies.length > 0 && !!options['recursive']) {
            whenVerbose('recurse: fetching recursive dependencies')
            return Promise.all(dependencies.map((d) => {
              return fetch(d)
            }))
              .then((dependencies) => {
                dependency.dependencies = dependencies
                whenVerbose('recurse: processed dependencies')
                whenVerbose(dependencies)
                return Promise.resolve(dependency)
              })
              .catch(reject)
          } else if (dependencies.length === 0) {
            whenVerbose('recurse: no recursive dependencies found')
          } else {
            whenVerbose('recurse: skipping recursive dependencies')
          }

          return Promise.resolve(dependency)
        })
        .then((dependency) => {
          let compatibilities = dependency.compatibilities || []
          if (compatibilities.length > 0 && !!options['compatibilities'] && !!options['recursive']) {
            whenVerbose('recurse: fetching recursive compatibilities')
            return Promise.all(compatibilities.map((d) => {
              return fetch(d)
            }))
              .then((compatibilities) => {
                whenVerbose('recurse: processing compatibilities')
                dependency.dependencies = dependency.dependencies.concat(compatibilities)
                whenVerbose('recurse: processed compatibilities')
                whenVerbose(compatibilities)
                return resolve(filterImplementationDependencies(dependency))
              })
              .catch(reject)
          } else if (compatibilities.length === 0) {
            whenVerbose('recurse: no recursive compatibilities found')
          } else {
            whenVerbose('recurse: skipping recursive compatibilities')
          }
          return resolve(filterImplementationDependencies(dependency))
        })
        .catch(reject)
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

        dependency.location = path.resolve(process.cwd(), description.location)

        if (description.type === 'implementation') {
          if (dependency.destination) {
            if (!dependency['short-name']) {
              let shortName = path.basename(dependency.destination.file)
              whenVerbose('processDescription: using destination ' + shortName + ' as a short-name for the implementation')
              dependency['short-name'] = shortName
              description['short-name'] = shortName
            } else if (dependency['short-name'] !== path.basename(dependency.destination.file)) {
              return Promise.reject(new Error('Inconsistent short-name between implementation destination ' + dependency.destination.file + ' and asked short-name ' + dependency['short-name']))
            }
          }
        }

        dependency['short-name'] = dependency['short-name'] || description['short-name']
        description['short-name'] = dependency['short-name']

        let isWuWeiRepositorySubdir = dependency.location.indexOf(suiteRoot) !== -1
        let isWuSubdir = dependency.location.indexOf(wuDirPath) !== -1

        if (isWuWeiRepositorySubdir &&
          (!isWuSubdir ||
          ((dependency.source.type === 'directory' || dependency.source.type === 'file') &&
          dependency.source.value.indexOf(wuDirPath) !== -1))) {
          // We do not duplicate artifacts within the repository or an existing artifact
          dependency.destination = null
        } else {
          // We import artifacts from elsewhere into the repository
          // by copying them
          dependency.destination = dependency.destination || {'file': path.join(suiteRoot, description.type + 's', dependency['short-name'])}
        }

        if (!dependency.dependencies) {
          dependency.dependencies = []
        }

        if (description.dependencies) {
          dependency.dependencies = description.dependencies.concat(dependency.dependencies)
        }

        if (!dependency.compatibilities) {
          dependency.compatibilities = []
        }

        if (description.compatibilities) {
          dependency.compatibilities = description.compatibilities.concat(dependency.compatibilities)
        }

        let tmpDescription = configLib.deepcopy(description)
        configLib.resolvePaths(tmpDescription)
        configLib.expand(tmpDescription)

        if (tmpDescription.type === 'compiler') {
          let errors = []
          tmpDescription.commands.forEach((c, i) => {
            let execPath
            if (c['executable-name']) {
              execPath = shelljs.which(c['executable-name'])
            } else if (c['executable-path']) {
              execPath = shelljs.which(c['executable-path'])
            } else {
              errors.push('No executable specified in command #' + i)
              return
            }

            if (execPath === null) {
              errors.push("Could not find executable '" + JSON.stringify((c['executable-name'] || c['executable-path'])) + "' in command #" + i)
            } else {
              whenVerbose('autocomplete: found command ' + execPath + ' in command #' + i + ' from compiler ' + dependency.source.value)
            }
          })

          if (errors.length > 0) {
            return Promise.reject(new Error('Error(s) when validating compiler commands from ' + dependency.source.value + ':\n' + errors.join('\n')))
          }
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

    if (!dependency.location) {
      return Promise.reject(new Error('Missing dependency location in ' + JSON.stringify(dependency)))
    }

    let location = dependency.location.file
    let files = fs.readdirSync(location)
    whenVerbose('     location content: ' + files)
    // If there is a single directory into the fetched content, recurse into it
    // to possibly find an artifact in order to deal with 
    // archives that expand into an additional subdirectory
    if (files.length === 1) {
      let file = path.resolve(location, files[0])
      if (fs.statSync(file).isDirectory() && file.indexOf(wuDirPath) > -1) {
        location = file
      }
    }

    return findArtifactDescription(location)
      .then(processDescription)
      .then(validate)
      .then(recurse)
  }

  function fetch (dependency) {
    whenVerbose('fetch(' + JSON.stringify(dependency) + ')')

    if (typeof dependency === 'string') {
      dependency = {
        source: dependency
      }
    } else if (Object.prototype.isPrototypeOf(dependency)) {
      if (!dependency.source) {
        return Promise.reject(new Error('fetch: No dependency source provided in ' + JSON.stringify(dependency)))
      }
    } else {
      return Promise.reject(new Error('fetch: Invalid argument ' + dependency + ', expected a string or an object'))
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
      parsed.type === 'file' ||
      (parsed.type === 'directory' &&
      path.resolve(process.cwd(), parsed.value).indexOf(suiteRoot) === -1)) {
      return fetchFromCache(dependency)
        .then(fetchRemote)
        .then(saveInCache)
        .then(autocomplete)
    } else if (parsed.type === 'short-name') {
      dependency.source = registry[parsed.value]
      return fetch(dependency)
    } else if (parsed.type === 'directory') {
      dependency.location = { 'file': parsed.value }
      return Promise.resolve(dependency)
        .then(autocomplete)
    } else {
      throw new Error('Invalid parse type ' + parsed.type)
    }
  }

  function installNodePackage (dependency) {
    return new Promise(function (resolve, reject) {
      try {
        // If this is a node package, install dependencies
        let filePath = path.join(dependency.location, 'package.json')
        var f = fs.statSync(filePath)
        if (f.isFile()) {
          whenVerbose('install: installing npm dependencies in ' + filePath)
          shelljs.exec(
            'cd ' + dependency.location + ' && npm install',
            {async: true, silent: true},
            function (code, stdout, stderr) {
              if (code !== 0) {
                return reject(stderr)
              }
              whenVerbose(stdout)
              return resolve(dependency)
            })
          return
        } else {
          whenVerbose('install: ' + filePath + ' is not a file')
        }
      } catch (err) {
        whenVerbose('install: skipping npm dependency installation (or no npm dependencies)')
      }

      return resolve(dependency)
    })
  }

  function installCustom (dependency) {
    return new Promise(function (resolve, reject) {
      try {
        // Run the custom 'install' script
        var f = fs.statSync(path.join(dependency.location, 'install'))
        if (f.isFile()) {
          let cmd = 'cd ' + dependency.location + ' && ./install && cd -'
          console.log('install: executing custom install script:\n' + cmd)
          shelljs.exec(
            cmd,
            {async: true, silent: true},
            function (code, stdout, stderr) {
              if (code !== 0) {
                console.log('install: error during execution of ' + cmd + ':\n' + stderr + stdout)
                return reject(stderr)
              }

              whenVerbose(stdout)
              whenVerbose(stderr)
              whenVerbose('install: custom install script completed')
              return resolve(dependency)
            })
          return
        } else {
          whenVerbose('install: install script is not a file')
        }
      } catch (err) {
        whenVerbose('install: skipping install script (no install script)')
      }

      return resolve(dependency)
    })
  }

  function updateDescription (dependency) {
    if (dependency.type !== 'file') {
      return findArtifactDescription(dependency.location)
        .then((description) => {
          let updateNeeded = false
          if (description['short-name'] !== dependency['short-name']) {
            whenVerbose('updateDescription: replacing source short-name ' + description['short-name'] + ' with ' + dependency['short-name'])
            description['short-name'] = dependency['short-name']
            updateNeeded = true
          }

          if (description.filename !== description.type + '.json') {
            let canonicalName = description.type + '.json'
            whenVerbose("updateDescription: replacing original filename '" + description.filename + "' with canonical name '" + canonicalName)
            description.filename = canonicalName
          }

          if (updateNeeded) {
            whenVerbose('updateDescription: replacing original file')
            let descriptionPath = path.join(description.location, description.filename)
            delete description.location
            delete description.filename
            fs.writeFileSync(descriptionPath, JSON.stringify(description, null, '  '))
          }

          return Promise.resolve(dependency)
        })
    } else {
      return Promise.resolve(dependency)
    }
  }

  function install (dependency) {
    function installOne (dependency) {
      return updateDescription(dependency)
        .then(installNodePackage)
        .then(installCustom)
    }

    if (dependency.dependencies) {
      return Promise.all(dependency.dependencies.map(install))
        .then((dependencies) => {
          return installOne(dependency)
        })
    } else {
      return installOne(dependency)
    }
  }

  function move (dependency) {
    function moveOne (dependency) {
      if (dependency.destination) {
        if (exists(dependency)) {
          whenVerbose('move: destination ' + dependency.destination + ' already exists, skipping dependency:')
          whenVerbose(dependency)
          return Promise.resolve(dependency)
        }

        whenVerbose('move: cp -r ' + dependency.location + ' ' + dependency.destination)
        shelljs.cp('-r', dependency.location, dependency.destination)
        dependency.location = dependency.destination
        return Promise.resolve(dependency)
      } else {
        whenVerbose('move: destination null, nothing to move for ')
        whenVerbose(JSON.stringify(dependency))
        return Promise.resolve(dependency)
      }
    }

    if (dependency.dependencies) {
      return Promise.all(dependency.dependencies.map(move))
        .then((dependencies) => {
          dependency.dependencies = dependencies
          return moveOne(dependency)
        })
    } else {
      return moveOne(dependency)
    }
  }

  return {fetch: fetch, exists: exists, install: install, move: move}
}
exports.Installer = Installer
