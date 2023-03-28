    const express = require('express');
    const app = express();
    const config = require('./config');
    const mongoDBkey = config.mongoDBkey;
    const MongoClient = require('mongodb').MongoClient
    const bodyParser = require('body-parser');
    const { ObjectId } = require('mongodb');
    const retiradores = require('./retiradores.json');


//necesitamos 2 funciones que modifique el objeto de stock original. y 1 funcion que lo copie como stock del dia.
/* logic: tenemos 1 objeto que es stock actual, y todos los dias hacemos y guardamos una copia.  */

MongoClient.connect(mongoDBkey, { useUnifiedTopology: true })
    .then(client => {
        console.log('Connected to Database')
        const db = client.db('vacios-perinola')
        const vaciosCollection = db.collection('vacios-y-pales')
        const retirosCollection = db.collection('retiros-y-cambios')
        app.set('view engine', 'ejs')
        app.use(express.static('public'))
        app.use(bodyParser.urlencoded({ extended: true }))

        app.get('/', (req, res) => { //renders main page vision

            retirosCollection.find().toArray()
                .then(results => {               
                    let dispRet = displayRetiros(results)
                    vaciosCollection.find().toArray()
                        .then(results => {
                            stock = displayStock(results) //stock is purely a variable for rendering, so modifying it is ok
                            res.render('index.ejs', { retiradores: retiradores.retiradores, data: {dispRet: dispRet,
                                                    stock : stock}})
                        })
                })
        })
        app.get('/cierre', (req, res) => {
            let vaciospresentes = vaciosCollection.findOne({ "tipo": "vacios sueltos"})  
                .then(result => {
                    const vacios = result["vacios que entraron"]
                    res.render('cierre.ejs', {vacios: vacios})
                }) //piramide de .thens para obtener los valores que quiero. incorporarlos a calculo final.  


        })
       
        app.post('/addPales', (req, res) => { 
            const entradaStock = {[req.body.tipoPale]: Number(req.body.numeroDePalesIntroducidos)}
            const stockActualizado = vaciosCollection.findOne({ "tipo": "stock actual de pales"})  
                 .then(result => {
                    const thisisresult = mergeStocks(result, entradaStock)
                    vaciosCollection.replaceOne({ "tipo": "stock actual de pales"}, thisisresult)
                    res.redirect('/')
                    
                })
                .catch(error => console.error(error)) 
        }) //esta funcion añade los pales "creados" al objeto "stockActual"



        app.post('/addVacios', (req, res) => {
            const entradaVacios = {"vacios que entraron": Number(req.body.cuantosVaciosEntraron), "tipo": "vacios sueltos", "fecha de ingreso": returnDate()}
            vaciosCollection.insertOne(entradaVacios)
                .then(result => {
                    res.redirect('/')            
            })
        })
        app.post('/retirarVacios', (req, res) => {
            const retiroVacios = {"vacios que salieron": -Number(req.body.cuantosVaciosSalieron), "retirador": req.body.retiradorDeVacios, "tipo": "vacios sueltos", "fecha de retiro": returnDate()}
            retirosCollection.insertOne(retiroVacios)
                .then(result => {
                    res.redirect('/')            
            })
        })
        app.post('/retirarPales', (req, res) => { 
            const salidaStock = {[req.body.paleABorrar]: -Number(req.body.numeroDePalesABorrar)}
            
            retirosCollection.insertOne({"retirador": req.body.retirador, "tipo": "pales", [req.body.paleABorrar]: Number(req.body.numeroDePalesABorrar), "fecha de retiro" : returnDate()})
            const stockActualizado = vaciosCollection.findOne({ "tipo": "stock actual de pales"})  
                 .then(result => {
                    const thisisresult = mergeStocks(result, salidaStock)
                    vaciosCollection.replaceOne({ "tipo": "stock actual de pales"}, thisisresult)
                    res.redirect('/')
                })
                .catch(error => console.error(error)) 
        })

        app.listen(8000, function () {
            console.log('listening on 8000')
        }) //starts server
    })
    .catch(error => console.error(error))

function displayStock(stock) {
    let stockForDisplay = {}

    for (var i = 0; i < stock.length; i++) {
        for (let k in stock[i]) {
            if (k != "_id" && k != "fecha" && k != "tipo" && k != "fecha de retiro"  && k != "fecha de ingreso") {
                stockForDisplay[k] = stock[i][k]
            }
        }
    }
    return stockForDisplay
}
    
function displayRetiros(arr) {
        const result = {};
      
        // iterate over each object in the array
        arr.forEach((obj) => {
          const retirador = obj.retirador;
          // if retirador is not in result object, add it with empty object
          if (!result[retirador]) result[retirador] = {};
          // iterate over each key-value pair in the object
          Object.entries(obj).forEach(([key, value]) => {
            // if key is not "_id", "retirador", "fecha de retiro", or "tipo", it is a product
            if (key !== "_id" && key !== "retirador" && key !== "fecha de retiro" && key !== "tipo") {
              result[retirador][key] = (result[retirador][key] || 0) + value;
            }
          });
        });
      
        // convert result object to array of objects, remove tipo property, and return
        return Object.entries(result).map(([retirador, products]) => {
          const { tipo, ...rest } = products;
          return { retirador, ...rest };
        });
}

function returnDate() {
    let date_ob = new Date();
    let date = ("0" + date_ob.getDate()).slice(-2);
    let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
    let year = date_ob.getFullYear();
    todayDate = `${date}/${month}/${year}`
    return todayDate
} //gives today's date

function mergeStocks(stock1, stock2){

    let stockArray = [stock1, stock2]
    let reducedArray = stockArray.reduce((stock1, stock2) => {
        for (const [productName, productCount] of Object.entries(stock2)) {
            if(!isNaN(productCount)){
                if (!stock1[productName]) {
                    stock1[productName] = 0;
                }
                stock1[productName] += Number(productCount)
            } else { stock1[productName] = productCount}
            
            
        }
        
        return stock1;
    }, {})  
    return reducedArray
   
} 
    


