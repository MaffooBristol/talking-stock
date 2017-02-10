var socket = io();

socket.on('tick', function (res) {
  document.getElementById('container').classList.remove('loading');
  document.getElementById('status').classList.add('updated');
  var output = '<table>';
  res.data.forEach(function (ticker) {
    var movementClass = parseFloat(ticker.c_fix) > 0 ? 'up' : 'down';
    output += '<tr><td class="symbol"><strong>' + ticker.t + '</strong></td><td class="price">' + ticker.l + '</td><td class="movement ' + movementClass + '">' + ticker.cp + '%</td></tr>';
  });
  var totalMovementClass = parseFloat(res.total_c) > 0 ? 'up' : 'down';
  output += '<tr><td class="symbol"><strong>Total</strong></td><td class="price">' + res.total.toFixed(2) + '</td><td class="movement ' + totalMovementClass + '">' + res.total_c.toFixed(2) + '%</td></tr>';
  output += '</table>';
  setTimeout(function () {
    document.getElementById('status').classList.remove('updated');
    // document.querySelectorAll('.price').forEach(function (el) {
    //  el.classList.remove('updated');
    // });
  }, 500);
  document.getElementById('ticker').innerHTML = output;
});

socket.on('connect', function () {
  document.getElementById('status').classList.remove('disconnected');
});

socket.on('disconnect', function () {
  document.getElementById('status').classList.add('disconnected');
});

var context;

try {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  context = new window.AudioContext();
}
catch (e) {
  alert("No Web Audio API support");
}

ss(socket).on('audio-stream', function (stream, data) {
  parts = [];
  stream.on('data', function (chunk) {
    parts.push(chunk);
  });
  stream.on('end', function () {
    socket.emit('audio:received');
    var fileReader = new FileReader();
    fileReader.onload = function() {
      var arrayBuffer = this.result;
      context.decodeAudioData(arrayBuffer, function (buffer) {
        var source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.start(0);
        socket.emit('audio:playing');
      });
    };
    fileReader.readAsArrayBuffer(new Blob(parts));
  });
});
