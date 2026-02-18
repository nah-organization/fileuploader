[![Docker Build](https://github.com/8128-33550336/fileuploader/actions/workflows/build.yml/badge.svg?event=push)](https://github.com/8128-33550336/fileuploader/actions/workflows/build.yml)
[![Deploy to Firebase Hosting on merge](https://github.com/nah-organization/fileuploader/actions/workflows/firebase-hosting-merge.yml/badge.svg)](https://github.com/nah-organization/fileuploader/actions/workflows/firebase-hosting-merge.yml)

## `GET /`
Redirect to [https://uploader.nahsns.ga/](https://uploader.nahsns.ga/)

## `POST /?file=test.txt&mime=text/plain`
Upload
File Payload
### Return 
```json
{
    "id": "3742876774898678483729874384623579677850837501605683190473807270736501653016950660386526013685638127064365863",
    "url": "https://hostname:port/3742876774898678483729874384623579677850837/test.txt",
    "delete": "this is delete password. can't change this password."
}
```

## `GET /3742876774898678483729874384623579677850837501605683190473807270736501653016950660386526013685638127064365863/dl/test.txt`
Download

## `DELETE /3742876774898678483729874384623579677850837501605683190473807270736501653016950660386526013685638127064365863/test.txt`
row password payload

# Flow

## firebase

## fileuploader

## qrcode

