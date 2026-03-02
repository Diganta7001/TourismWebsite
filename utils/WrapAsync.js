module.exports = (fn)=>{
    return (err,req,res,next)=>{
        fn(err,req,res,next).catch(next)
    }
}