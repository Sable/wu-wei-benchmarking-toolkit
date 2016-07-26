var express = require('express')
var path = require('path')
var app = express()
app.use(express.static(process.argv[2]))

app.listen(8080, function () {
  console.log('Serving static files from ' + process.argv[2])
})
