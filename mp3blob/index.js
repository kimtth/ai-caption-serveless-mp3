const mp3lame = require('lamejs');
const Blob = require("cross-blob");
const Util = require('./util.js');
const multipart = require("parse-multipart-data");

const Mp3Encoder = mp3lame.Mp3Encoder
const handleFileUploadBlob = Util.handleFileUploadBlob;
const isEmpty = Util.isEmpty;
let mp3enc;

module.exports = async function (context, request) {
    context.log('HTTP trigger function processed a request.');
    // const name = (req.query.name || (req.body && req.body.name));

    if (request.method === "POST") {
        const bodyBuffer = Buffer.from(request.body);
        const boundary = multipart.getBoundary(request.headers['content-type']);
        // parse the body
        const parts = multipart.parse(bodyBuffer, boundary);

        let channelId = null;
        let messageId = null;
        let byteCount = 0
        let wavData = null;

        // FormData Parsing
        for (const part of parts) {
            if (part.name !== undefined) {
                const base64 = part.data;
                const buff = Buffer.from(base64, 'base64');
                const str = buff.toString('utf-8');
                if (part.name.includes('channel')) {
                    channelId = str;
                } else if (part.name.includes('message')) {
                    messageId = str;
                } else {
                    byteCount = parseInt(str, 10);
                }
            } else {
                wavData = part.data;
                console.debug('>>>>>>>>', wavData.length)
            }
        }

        context.log(">>>>>>", channelId, messageId, ">>>>>>");

        if (isEmpty(channelId) || isEmpty(messageId) || isEmpty(wavData)) {
            const responseMessage = `The data is undefined. ${channelId} ${messageId}`
            context.res = {
                body: responseMessage,
                status: 400 //bad requests
            };
            return
        }

        try {
            pcmToMp3convertAsync(channelId, messageId, byteCount, wavData)
                .then(res => {
                    context.log(res)
                }).catch(err => {
                    context.log(err)
                })
            context.res = {
                // status: 200, /* Defaults to 200 */
                body: responseMessage
            };
        } catch (error) {
            context.res = {
                body: error,
                status: 400 //bad requests
            };
        }
    }
}

async function pcmToMp3convertAsync(channelId, messageId, byteCount, wavData) {
    return await pcmToMp3convert(channelId, messageId, byteCount, wavData)
}

function pcmToMp3convert(channelId, messageId, byteCount, wavData) {
    return new Promise((resolve, reject) => {
        try {
            let wavSampleRate = 16000;
            let wavDataLen = byteCount;

            const wavSamples = new Int16Array(
                wavData.buffer,
                0,
                wavDataLen / 2
            );

            wavToMp3async(
                1, //channel
                wavSampleRate,
                wavSamples
            ).then(mp3File => {
                //Kim: upload mp3 to azure storage
                const fileId = messageId;
                const filename = `${fileId}.mp3`
                if (mp3File.size > 0) {
                    handleFileUploadBlob(mp3File, filename, channelId);
                }
            }).catch(err => {
                console.log('mp3 convert', err)
            });

            resolve('pcm to mp3 done!');
        } catch (error) {
            reject(error)
        }
    })
}

async function wavToMp3async(channels, sampleRate, binaryData) {
    return await wavToMp3(channels, sampleRate, binaryData)
}

function wavToMp3(channels, sampleRate, binaryData) {
    let buffer = [];

    return new Promise((resolve, reject) => {
        try {
            if (isEmpty(mp3enc))
                mp3enc = new Mp3Encoder(channels, sampleRate, 128);

            let remaining = binaryData.length;
            const maxSamples = 1152;
            for (let i = 0; remaining >= maxSamples; i += maxSamples) {
                let mono = binaryData.subarray(i, i + maxSamples);
                let mp3buf = mp3enc.encodeBuffer(mono);
                if (mp3buf.length > 0) {
                    buffer.push(new Int8Array(mp3buf));
                }
                remaining -= maxSamples;
            }
            const d = mp3enc.flush();
            if (d.length > 0) {
                buffer.push(new Int8Array(d));
            }

            console.log('done encoding, size=', buffer.length);

            const blob = new Blob(buffer, {
                type: 'audio/mp3'
            });
            resolve(blob);
        } catch (error) {
            reject(error)
        }
    })
}