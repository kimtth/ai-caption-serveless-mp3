const blob = require('@azure/storage-blob');
const BlobServiceClient = blob.BlobServiceClient


exports.isEmpty = function (val) {
    return (val === undefined || val === null || val.length <= 0) ? true : false;
}

exports.handleFileUploadBlob = async (fileBlob, filename, channelId) => {
    const REACT_APP_AZURE_STORAGE_CONTAINER_CONNECTION = 'https://siactranslatorbotdiag.blob.core.windows.net/?sv=2019-12-12&ss=b&srt=sco&sp=rwdlacx&se=2040-12-25T12:48:54Z&st=2020-12-25T04:48:54Z&spr=https&sig=ZmpbGoKwnox3HtmgJ3Ffy%2BAu8wMNdtKLT2y2o5etJ8Q%3D'
    
    try {
        if (isEmpty(blobServiceClient)) {
            blobServiceClient = new BlobServiceClient(REACT_APP_AZURE_STORAGE_CONTAINER_CONNECTION);
        }
        const containerName = channelId;
        let containerClient = blobServiceClient.getContainerClient(containerName);
        const isExits = await containerClient.exists();
        if (!isExits) {
            const createContainerResponse = await containerClient.create();
            console.log(`Create container ${containerName} successfully`, createContainerResponse.requestId);
        }

        containerClient = blobServiceClient.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(filename);
        console.log('\nUploading to Azure storage as blob:\n\t', filename);

        // Upload data to the blob
        const uploadBlobResponse = await blockBlobClient.upload(fileBlob, Buffer.byteLength(fileBlob));
        console.log("Blob was uploaded successfully. requestId: ", uploadBlobResponse.requestId);
    } catch (err) {
        console.log(err)
    }
}