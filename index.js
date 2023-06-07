const express = require('express')
const app = express()
const jwt = require('jsonwebtoken');
const cors = require('cors')
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

// middelware
app.use(cors())
app.use(express.json())


const verifyJwt = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.d4rcuph.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const menuCollection = client.db('bistroDB').collection("menu")
    const usersCollection = client.db('bistroDB').collection("users")
    const reviewsCollection = client.db('bistroDB').collection("reviews")
    const cartsCollection = client.db('bistroDB').collection("carts")


    app.post('/jwt',(req, res)=>{
      const user = req.body;
      const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{expiresIn: '24h'})
      res.send({token})
    })
    // warning: use verifyjwt before using verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

    /* 
    0.do not show secure link to those who should not see the links
    *1.use jwt token : verifyjwt
    2.use verify middleware
    */


// users related apis

    app.get('/users', verifyJwt, verifyAdmin, async(req, res)=>{
        const result = await usersCollection.find().toArray()
        res.send(result)
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    // sequrity layer: verifyJwt
    // email same
    // check admin
    app.get('/users/admin/:email', verifyJwt, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })

    app.patch('/users/admin/:id', async(req, res)=>{
      const id = req.params.id
      const filter = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          role: "admin"
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    app.delete('/menu/:id', verifyJwt, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    })
// menu related api
    app.get('/menu', async(req, res)=>{
        const result = await menuCollection.find().toArray()
        res.send(result)
    })

    app.post("/menu" , async(req, res)=>{
      const newItem = req.body;
      const result = await menuCollection.insertOne(newItem)
      res.send(result)
    })

    // review related apis
    app.get('/reviews', async(req, res)=>{
        const result = await reviewsCollection.find().toArray()
        res.send(result)
    })
// cart collection api
app.get('/carts',verifyJwt, async(req, res)=>{
    const email = req.query.email;
    // console.log(email);
    if(!email){
        res.send([])
    }
    const decodedEmail = req.decoded.email
    if(email !== decodedEmail){
      return res.send(401).send({error: true, message: 'porviden access'})
    }
    const query = {email: email}
    const result = await cartsCollection.find(query).toArray()
    res.send(result)
})

app.post('/carts', async(req, res)=>{
    const item = req.body
//   console.log(item);
    const result = await cartsCollection.insertOne(item)
    res.send(result)
})

// delete operation
app.delete('/carts/:id',async(req, res)=>{
    const id = req.params.id
    const query = {_id: new ObjectId(id) };
    const result = await cartsCollection.deleteOne(query)
    res.send(result);
  })

  // create payment intent
app.post('/create-payment-intent',verifyJwt, async(req, res)=>{
  const {price} = req.body;
  const ammount = price*100 
  const paymentIntent = await stripe.paymentIntents.create({
    amount: ammount,
    currency: "usd",
    payment_method_types: ['card']
  });
  res.send({
    clientSecret : paymentIntent.client_secret
  })
})

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res)=>{
  res.send('boss is here')  
})

app.listen(port, ()=>{
    console.log(`bistro boss is running in port ${port}`);
})