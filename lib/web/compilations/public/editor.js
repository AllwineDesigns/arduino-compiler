var editor = ace.edit("editor");
editor.getSession().setMode("ace/mode/c_cpp");

var boards = {
"arduino:avr:uno": {
    board: "arduino:avr:uno",
    commandline: "\"{runtime.tools.avrdude.path}/bin/avrdude\" \"-C{runtime.tools.avrdude.path}/etc/avrdude.conf\" {upload.verbose}  -patmega328p -carduino -P{serial.port} -b115200 -D \"-Uflash:w:{build.path}/{build.project_name}.hex:i\"",
    signature:"818f95e84bd149f2ad3cf82d383ca674b342f994921b34087afc6acc10b60370252fdf138a1f8e20666be623e13fdf976e4db145ded20cac7d324ae3f398093e8644f4f575bf65d988db0e9e4bd832756d54bc07b6478100c615ae49272f4b1eece680850fd8c63d772883783f4ea8e122a8e189e253c90978a6417cf4217e7c88d06fd2e470ffbad316537669b6db9b7de9709934aab3f12de5c3a2a8df30a91a84acf66487ed80cc286a50a598f855f4df4296eba07e49f054e0fec0d32b0928a68e6634cf656f41a3c663fbdf4e48b253dcfa02cc2d0826c216e4c2e979f5b43b1a2f171f75ea0fecf61b094a1896a8494eceda7899a4a02ca75d1f40790b",
    label: "Arduino Uno",
    wait_for_upload_port: false,
    use_1200bps_touch: false

},
"arduino:avr:micro": {
    board: "arduino:avr:micro",
    commandline: "\"{runtime.tools.avrdude.path}/bin/avrdude\" \"-C{runtime.tools.avrdude.path}/etc/avrdude.conf\" {upload.verbose}  -patmega32u4 -cavr109 -P{serial.port} -b57600 -D \"-Uflash:w:{build.path}/{build.project_name}.hex:i\"",
    signature: "15a80bb8e911d82ee8c36d14bc5c00348f307ac8eaba5357366eeeb776a2e4eefa85a061d22ebde27482841de67e95d471700e8487adf3adda94d2b1091c68ab4d5b5098ad6f3f0e63878be52b3459a3966e82bbf0f160f13f2fcbc2ae06f296271f19bc8fef67e038b12746fc863e76df2929ee6f2f18b604825615179da99d6a62f9e6ac6ce88f4b80c1399c9e81b734c938b34cfc1147e111bafa2ccab786cc6649baa61e45f6bf8a7a41607052207f00b3fa1c10c518804d19de55af182019ee32d99405dedfd970cd0be57953b26c6b6ca3343e25a39936583cad9894e209a38c09eb8bd74d4df99812c8a939001f0242c544b43e5f853c02de949a29a8",
    label: "Arduino Micro",
    wait_for_upload_port: true,
    use_1200bps_touch: true
}
};

var protocol = window.location.protocol.slice(0, -1);
var ws_protocol = protocol == "http" ? "ws" : "wss";

var info;
var socket;
var ports = [];

var upload = function(hex) {
    console.log(ports.length);
    if(!ports.length) {
      setTimeout(function() { upload(hex) }, 1000);
      console.log("not ready to upload hex file... trying again in 1 second");
      return;
    }
    socket.emit('command', 'list');

    var board = boards[$("#board").val()];
    var payload = JSON.stringify({
      "board": board.board,
      "port": ports[0].Name,
      "commandline": board.commandline,
      "signature": board.signature,
      "hex": hex,
      "filename":"sketch.hex",
      "extra": {
        "auth": {
          "password":null
        },
        "wait_for_upload_port":board.wait_for_upload_port,
        "use_1200bps_touch":board.use_1200bps_touch,
        "network":false,
        "params_verbose":"-v",
        "params_quiet":"-q -q",
        "verbose":false
      }
    });
    console.log(payload);

    $.post(info[protocol] + "/upload", payload, function(data, status) {
      console.log(data);
      console.log(status);
    });
};

$("#upload").click(function() {
var board = boards[$("#board").val()];
var args = {
  script: editor.getValue(),
  board: board.board
};
$.post("/compilations", args,
function(data, status) {
  if(status == "success") {
    console.log(data);
    var getHex = function() {
      $.get(data.link, {}, function(data, status) {
            if(status == "success") {
              if(data.isReady) {
                  upload(data.hex);
                console.log(data.hex);
              } else {
                setTimeout(getHex, 1000);
              }
            } else {
              console.log("error checking link");
            }
        });
    };
    setTimeout(getHex, 1000);
  } else {
    console.log("Error uploading");
  }
});
});

var checkPort = function(port) {
    $.ajax({ url: protocol + "://localhost:" + port + "/info" }).done(function(data) {
        info = data;
        socket = io(info[ws_protocol]);
        socket.on('connect', function() {
          socket.on('message', function(msg) {
            try {
              var obj = JSON.parse(msg);
              
              if(obj.Ports) {
                console.log("set ports");
                ports = obj.Ports;
              }
            } catch(e) {
            }
          });
          socket.emit('command', 'list');
        });
        console.log(info);
    }).fail(function(err) {
      if(port < 9000) {
          checkPort(port+1);
      }
    });
};
checkPort(8990);
