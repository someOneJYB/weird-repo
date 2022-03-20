const f = () => {
    return new Promise((res, rej) => {
            new Promise(() => {
                rej(123)
            })
        }
    )
}
const a = async() => {
    let res = ''
    try {
        res = await f();
    } catch (err) {

    }
    console.log(res)
}
