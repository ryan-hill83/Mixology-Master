const express = require('express')
const mustacheExpress = require('mustache-express')
const bodyParser = require('body-parser')
const app = express()
const session = require('express-session')
const bcrypt = require('bcryptjs')
const cocktailAPI = `https://www.thecocktaildb.com/api/json/v1/1/`
var fetch = require('node-fetch')
const cookieParser = require('cookie-parser')
const cache = require('express-cache-response')
let cache_drinks
let username
app.use(session({
    key: 'userid',
    secret: 'cat',
    resave: false,
    saveUninitialized: false
  }))

const pgp = require('pg-promise')()
const cn = {
    host : 'ec2-54-83-38-174.compute-1.amazonaws.com',
    port : 5432,
    database : 'daa7lr4594n063',
    user: 'moqnblcbwdcfsg',
    password:'7d60c59b692b1f04f93c992a2226b602d1ea263c8e4d4ea2fad603749245f0b6',
    ssl:true
}
const db = pgp(cn)
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.static('public'))
app.use(cookieParser());
app.engine('mustache',mustacheExpress())
app.set('views','./views')
app.set('view engine','mustache')


app.use(cache())



app.get('/drink',function(req,res){
  res.render('drink')
})
//Kevin's Work
app.post('/getSingleCocktail', function (req, res) {
  let drinkID = req.body.drinkID
  fetch(cocktailAPI + "lookup.php?i=" + drinkID).then(res => res.json()).then(json => {
    json.drinks.map(function (drink) {
      drink.drinkIngredients = []
      drink.ingredients = []
      drink.proportions = []
      Object.keys(drink).map(function (key, value) {
        if (key.startsWith("strIngredient")) {
          if (drink[key] != '' && drink[key] != null && drink[key] != ' ') {
            drink.ingredients.push({
              ingredient: drink[key]
            })
          }
        }
        if (key.startsWith("strMeasure")) {
          if (drink[key] != '' && drink[key] != null && drink[key] != ' ') {
            drink.proportions.push({
              proportion: drink[key]
            })
          }
        }
      })
      for (i = 0; i < drink.ingredients.length; i++) {
        if (drink.proportions[i] == undefined) {
          drink.proportions[i] = "nothing m8"
        }
        drink.drinkIngredients.push({
          proportion: drink.proportions[i].proportion,
          ingredient: drink.ingredients[i].ingredient
        })
        console.log(drink.drinkIngredients[i])
      }
    })
    db.any('SELECT * FROM user_comment WHERE iddrink =$1',[drinkID])
    .then(function(result){
    cache_drinks = json.drinks
    res.render('drink', {
      drinks: json.drinks,
      drink_comment:result,
      username:req.session.username,
      register: function(){
        if(!req.session.username){
          return true
        }else{return false}
      }

    })
  })
    .catch(function(){

      cache_drinks = json.drinks
      res.render('drink', {
        drinks: json.drinks,
        username:req.session.username,
        register: function(){
          if(!req.session.username){
            return true
          }else{return false}
        }

    })
    })
  })
})

app.post('/getCocktails', function (req, res) {
  let serchTerm = req.body.query
  fetch(cocktailAPI + "search.php?s=" + serchTerm).then(res => res.json()).then(json => {
    json.drinks.map(function (drink) {
      drink.drinkIngredients = []
      drink.ingredients = []
      drink.proportions = []
      Object.keys(drink).map(function (key, value) {
        if (key.startsWith("strIngredient")) {
          if (drink[key] != '' && drink[key] != null && drink[key] != ' ') {
            drink.ingredients.push({
              ingredient: drink[key]
            })
          }
        }
        if (key.startsWith("strMeasure")) {
          if (drink[key] != '' && drink[key] != null && drink[key] != ' ') {
            drink.proportions.push({
              proportion: drink[key]
            })
          }
        }
      })
      for (i = 0; i < drink.ingredients.length; i++) {
        if (drink.proportions[i] == undefined) {
          drink.proportions[i] = "nothing m8"
        }
        drink.drinkIngredients.push({
          proportion: drink.proportions[i].proportion,
          ingredient: drink.ingredients[i].ingredient
        })
      }
    })
    res.render('result', {
      drinks: json.drinks,
      username:req.session.username,
      logout:'Logout',
      type:'submit',
      button:'btn btn-primary',
      register: function(){
        if(!req.session.username){
          return true
        }else{return false}
      }
    })
  })
})

app.post('/register', function(req,res){
        let username = req.body.username
        let password = req.body.password
        let encrypted_password = bcrypt.hashSync(password,10)
        db.none('INSERT INTO user_account(username,password) VALUES($1,$2)',[username, encrypted_password])
        .then(function(){
           res.redirect('/')
        })
        .catch(function(error){
            res.render('register', {error: 'Username is already taken. Please select a different username.'})

        })
    })

app.post('/login', function(req, res){
        let username = req.body.username
        let password = req.body.password
        db.any('SELECT userid, username, password FROM user_account WHERE username =$1',[username])
        .then(function(result){
            let user = result.find(function(user){
               if(bcrypt.compareSync(password, user.password)){
                   return user.username == username
               }else{
                   res.render('index', {error: 'Please enter a valid username and password.'})
               }
            })
            if(user != null){
                if(user.username){
                    req.session.username=username
                    console.log(username)
                    db.any('SELECT * FROM drink_recipe WHERE username=$1',[username])
                    .then(function(result){
                      res.render('dashboard',{drink_item: result,username:username, logout:'Logout', type:'submit', button:'btn btn-primary'})
                    })
                    .catch(function(){
                      res.render('dashboard',{username:username, logout:'Logout', type:'submit', button:'btn btn-primary'})
                    })

                }
            }else{
              //  res.redirect('index')
                res.render('index', {error: 'Please enter a valid username and password.'})
            }
        })
    })
//post comments to db
app.post('/enter_comment', function(req,res){
    let iddrink = req.body.iddrink
    let drinks =req.body.drinks
    console.log(req.session.username)

    let enter_comment = req.body.enter_comment
    db.none('INSERT INTO drink_recipe(iddrink) VALUES($1) ON CONFLICT (iddrink) DO NOTHING',[iddrink])
    db.none('INSERT INTO user_comment(iddrink,drink_comment,time_stamp, username) VALUES($1,$2,$3,$4)',[iddrink,enter_comment,new Date(),req.session.username])
    db.any('SELECT * FROM user_comment WHERE iddrink =$1',[iddrink])
    .then(function(result){
      res.render('drink',{drink_comment:result,
        drinks:cache_drinks,
        username:req.session.username,
        logout:'Logout',
        type:'submit',
        button:'btn btn-primary'
      })
    })

})

var sessionChecker = (req, res, next) => {
  if (!req.session.username) {
      res.render('index', {register: 'Register', login:'Login', type:'hidden', link:'nav-link dropdown-toggle'});
  } else {
      next();
  }
};
app.get('/',sessionChecker, function(req,res){
        res.render('index')
})
app.get('/index',sessionChecker, function(req,res){
    res.render('index')
})
app.get('/register', function(req,res){
    res.render('register')
})



// app.use((req,res,next) =>{
//   if(req.cookies.user_id && !req.session.userame){
//     res.clearCookie('userid')
//   }
//   next()
// })

app.get('/logout',function(req,res){

  if(req.session.username && req.cookies.userid){
    res.clearCookie('userid')
    res.redirect('/')
  }else{
    res.redirect('/index')
  }
})

// app.get('/dashboard',function(req,res){
//   res.render('dashboard')
// })

app.post('/createdrink',function(req,res){
  let strdrink = req.body.strdrink
  let strcategory = req.body.strcategory
  let strglass = req.body.strcategory
  let strinstructions = req.body.strinstructions
  let strdrinkthumb = req.body.strdrinkthumb
  let stringredient = req.body.stringredient
  let username = req.session.username

    console.log(stringredient)


  db.none('INSERT INTO drink_recipe(strdrink,strcategory,strglass,strinstructions,strdrinkthumb,stringredient,username) VALUES($1,$2,$3,$4,$5,$6,$7)',[strdrink,strcategory,strglass,strinstructions,strdrinkthumb,[stringredient],username])
  db.any('SELECT * FROM drink_recipe WHERE username=$1',[username])
  .then(function(result){
    res.render('dashboard',{
      drink_item: result,
      username:username,
      logout:'Logout',
      type:'submit',
      button:'btn btn-primary',
    })
  })

})




app.listen(3000,function(req,res){
    console.log("Server has started...")
})

app.use(function (req, res, next) {
  res.status(404).send("Sorry can't find that!")
})
