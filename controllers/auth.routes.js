const router = require('express').Router()
const bcrypt = require('bcrypt')
const UserModel = require('../models/User')
const User = UserModel
const { BAHRAIN_NEIGHBORHOODS } = UserModel
const jwt = require('jsonwebtoken')

// POST /auth/sign-up
router.post('/sign-up', async (req, res) => {
  try {
    const { username, password, neighborhood, coordinates } = req.body

    // 1. Verify the username is not already taken
    const foundUser = await User.findOne({ username })
    if (foundUser) {
      return res.status(409).json({ err: 'Username taken. Please sign in or choose a different username.' })
    }

    // 2. Validate the neighborhood if provided
    if (neighborhood && !BAHRAIN_NEIGHBORHOODS.includes(neighborhood)) {
      return res.status(400).json({ err: `Invalid neighborhood. Valid options: ${BAHRAIN_NEIGHBORHOODS.join(', ')}` })
    }

    // 3. Build the location object
    // coordinates from frontend should be [longitude, latitude] (GeoJSON order)
    const location = {
      type: 'Point',
      coordinates: coordinates && coordinates.length === 2 ? coordinates : [50.5860, 26.2154],
      neighborhood: neighborhood || 'Manama'
    }

    // 4. Create the user with 100 starter eco-credits
    const createdUser = await User.create({
      username,
      hashedPassword: bcrypt.hashSync(password, 12),
      ecoCredits: 100,
      location
    })

    const userObject = createdUser.toObject()
    delete userObject.hashedPassword

    res.status(201).json({ user: userObject })
  } catch (err) {
    console.log(err)
    res.status(500).json({ err: err.message })
  }
})

// POST /auth/login

// 1. user sends POST request with username and password to login
// 2. get the user from db and check if they exist the DB
// 3. compare the password they give me vs the password in the DB
// 4. Sign a new JWT token send it back as a response

router.post('/sign-in',async(req,res)=>{
    try{
        const { username, password} = req.body // destructure the username and password

        // 2. get the user from db and check if they exist the DB

        const foundUser = await User.findOne({username:username})

        if(!foundUser){
            return res.status(401).json({err:'username not found, please signup'})
        }

        // 3. compare the password they give me vs the password in the DB

        const doesPasswordMatch = bcrypt.compareSync(password, foundUser.hashedPassword)

        if(!doesPasswordMatch){
            return res.status(401).json({err:'username or password incorrect'})

        }

        const payload = foundUser.toObject()
        delete payload.hashedPassword

        // 4. Sign a new JWT token send it back as a response
        const token = jwt.sign({payload},process.env.JWT_SECRET,{expiresIn:'24h'})

        res.json({token})
    }
    catch(err){
        console.log(err)
        res.status(500).json({err:err.message})
    }
})





module.exports = router