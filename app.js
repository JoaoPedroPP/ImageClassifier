var express = require('express');// express, para criar o aplicativo
var fs = require('fs'); // file system, para salvar os arquivos
var request = require('request');// request, para fazer as requisições
var url = require('url'); // // Nao esta mais sendo usada
var progress = require('progress-stream'); // Nao esta mais sendo usada
var http = require('http');// http, para criar o servidor e utilizar o protocolo

var app = express();// cria o aplicativo

var multer = require('multer'); // multer, biblioteca para fazer upload de arquivos https://github.com/expressjs/multer
var watson  = require('watson-developer-cloud/visual-recognition/v3');//necessario para chamar o watson
var visual_recognition = new watson({//api para o servio de video
  api_key: "1b85c953e5df6602f257569bd140e237f8670296",
  //url: "https://gateway-a.watsonplatform.net/visual-recognition/api", // desnecessario
  version_date: "2016-05-20"
});
app.set('port', process.env.PORT || 3000);// define a porta 3000 para o app
app.engine('html', require('ejs').renderFile);// necessario para renderizar a pagina html
// variavel storage usada com Multer definido onde salvar os aquivos no servidor e como salvar os nomes
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads')//define o destino da imagem
    },
    filename: function (req, file, cb) {
        //console.log(file.mimetype)
        cb(null, file.originalname + getExtension(file));//define o nome da imagem
    }
});

function getExtension(file) {
    //captura a extensao da imgem
    var res = '';
    if (file.mimetype === 'image/jpeg') res = '.jpg';
    if (file.mimetype === 'image/png') res = '.png';
    return res;
}

app.use(express.static('./')); // define a pasta root, onde os arquivos serao servidos

//variavel para inicializar o Multer com o storage ja definido
var upload = multer({
    storage: storage,
    }).fields([ // fields to accept multiple types of uploads
    { name: "fileName", maxCount: 1 } // in <input name='fileName' />
]);

//console.log(__dirname);
// para a tag input type=file
app.post('/uploads', function (req, res, next) {// para a requisicao POST, define para que pasta vai e o callback

  var prog = progress({time:100},function(progress){ // funcao criada para checar o carregamento da imagem a cada 100ms
    var len = this.headers['content-length'];//tamanho do conteudo
    var transf = progress.transferred;//tamanho do conteudo trasferido
    var result = Math.round(transf/len * 100)+'%';//porcentagem transferida
    console.log(result); // disponibiliza o resultado no console
    //if (result != '100%') res.send(result)

  });

  req.pipe(prog);
  prog.headers = req.headers;

    upload(prog, res, function (err) { //responsavel pelo upload da imagem. Troca de req para prog para seguir a porcentagem
      var classjson = null;
        if (err) {//tratamento de erro
            res.status(err.status || 500).json({ "error": { "status_code": err.status || 500, "message": err.code } });
            return;
        } else {

            var params = {//variavel para armazenar o arquivo que sera enviado para o watson visual recognition
              image_file: fs.createReadStream(prog.files.fileName[0].path)
            }
            visual_recognition.classify(params, function (err, resp){//metodo que requisita a analise de uma imgem no watson visual recognition
              if(err){//tratamento do erro
                console.log(err);
              }
              else{
                function conv(callback){
                  classjson = JSON.stringify(resp, null, 2);//converte o arquivo recebido em string
                  callback(load);//quando stringfy acabar chava fucao callback de argumento load
                }
                function save(callback){
                    fs.writeFile(__dirname+'/uploads/teste.json', classjson, function(err){//salva arquivo json
                      if(err){//tratamento do erro
                        console.log(err)
                      }
                    });
                    callback();//quando fs.write acabar chama funcao callback
                }
                function load(){//mostra o resultado da analise junto da imagem
                    res.writeHead(200,{'Content-Type':'text/html'});
                    res.write("<h1>Uploaded from file</h2><img style='max-width:20%' src='" + prog.files.fileName[0].path + "'/><pre>" + fs.readFile(__dirname+'/uploads/teste.json', 'utf8', function(error, data){res.end(data);}) + "</pre><a href='/'>Go back</a>");
                }
                conv(save);//chama funcao conv com argumento para callback a funcao save
              }
            });
        }
    });
});
http.createServer(app).listen(app.get('port'), '0.0.0.0', function () {//cria servidor http
    console.log('Express server listening on port ' + app.get('port'));
});
