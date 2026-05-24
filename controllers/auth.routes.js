const router = require('express').Router()
const bcrypt = require('bcrypt')
const User = require('../models/User')
const jwt = require('jsonwebtoken')

// POST /auth/sign-up
router.post('/sign-up', async (req,res)=>{

    try{
            // 1. verify that the username doesn't already exist in the Database
    const foundUser = await User.findOne({username:req.body.username})

    if(foundUser){
        return res.status(409).json({err:'Username taken please sign in or Sign up with different username'})
    }

    // 1.5: validation for password length and characters
    // Uncomment this if you want to enforce password with 1 letter, 1 number, 8 characters minimum
/*     const regexString = '^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$'

    if (!req.body.password.match(new RegExp(regexString))) {
        return res.status(400).json({
            err: 'Password must be minimum 8 characters, include at least one letter and one number'
        })
    } */

    // 2. save the user in the Database with the encrypted password
    const createdUser = await User.create({
        username: req.body.username,
        hashedPassword: bcrypt.hashSync(req.body.password,12)
    })

    const userObject = createdUser.toObject()
    delete userObject.hashedPassword
    // 3. send back the created user
    res.status(201).json({user:userObject})

    }
    catch(err){
        console.log(err)
        res.status(500).json({err:err.message})
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