var spawn = require('child_process').spawnSync
var hyperdb = require('hyperdb')
var hgit = require('.')

module.exports = function () {
  var remoteRef = process.argv[2]
  var dbName = process.argv[3].substring('hyper://'.length)
  console.error('dbhash', dbName)

  var db = hyperdb(dbName)
  var git = hgit(db)

  db.ready(function () {
    db.createHistoryStream()
      .on('data', function (node) {
        console.error('data', node.key, node.value.length)
      })
      .once('end', start)
  })
  return

  function start () {
    process.stdin.on('data', function (d) {
      var line = d.toString().trim()
      var cmd = line.split(' ')[0]
      var args = line.split(' ').slice(1)
      console.error('cmd', line)

      switch (cmd) {
        case 'capabilities':
          console.log('push')
          console.log('fetch')
          console.log()
          break
        case 'list':
          git.list(function (err, res) {
            res.forEach(function (ref) {
              console.log(ref.value, ref.name)
            })
            console.log()
          })
          console.log('a72a075cec49749270b57f6dd2392e8a0bcf749f master')
          console.log('@master HEAD')
          break
        case 'fetch':
          console.error('fetch hash', args[0])
          break
        case 'push':
          process.exit(1)
          var force = args[0].startsWith('+')
          var src = args[0].split(':')[0]
          if (force) src = src.substring(1)
          var dst = args[0].split(':')[1]
          var res = {}

          walkSync(src, res)

          var refCommit =
            spawn('git', ['rev-parse', src]).stdout.toString().trim()
          res[src] = refCommit

          console.error('walk', Object.keys(res))
          git.push(src, dst, res, function (err, results) {
            console.log('ok', src)
            console.log()
          })
          break
        case '':
          process.exit(0)
          break
        default:
          console.error('wtf', cmd)
          break
      }
    })
  }
}

function walkSync (ref, res) {
  var type = hashType(ref)
  console.error('@', ref, type)
  var rawContent = hashCat(ref)
  res[ref] = rawContent
  switch (type) {
    case 'commit':
      var content = rawContent.toString()
      var lines = content.split('\n')
      var tree = lines[0].split(' ')[1]
      walkSync(tree, res)
      break
    case 'tree':
      var content = rawContent.toString().trim()
      var lines = content.split('\n')
      lines.forEach(function (line) {
        walkSync(line.split(' ')[2].split('\t')[0], res)
      })
      break
    case 'blob':
      break
    default:
      console.error('unknown ref type', ref, type)
      break
  }
}

function hashType (hash) {
  return spawn('git', ['cat-file', '-t', hash]).stdout.toString().trim()
}

function hashCat (hash) {
  return spawn('git', ['cat-file', '-p', hash]).stdout
}
