import * as qrcode from "https://cdn.skypack.dev/qrcode@1.5.0";

const serverURL = new URL('https://33554432-2.local:4000/');

window.addEventListener('DOMContentLoaded', () => {
    const chooseButton = document.getElementById('chooseButton');
    const fileSelector = document.getElementById('fileSelector');

    const uploaded = document.getElementById('uploaded');

    chooseButton.addEventListener('click', () => {
        fileSelector.click();
    });
    fileSelector.addEventListener('input', () => {
        const file = fileSelector.files[0];
        if (!file) {
            return;
        }
        const uploadURL = new URL(serverURL);
        uploadURL.searchParams.set('file', file.name.replaceAll('/', ''));
        uploadURL.searchParams.set('mime', /\w+\/[-+.\w]+/.test(file.type) ? file.type : 'application/octet-stream');
        fetch(uploadURL, {
            method: 'POST',
            body: file,
        }).then(res => res.json()).then(res => {
            console.log(res);
            if (!res.id) {
                throw null;
            }
            uploaded.hidden = false;
            const deletePassword = res.deletePassword;
            const id = res.id;
            localStorage.setItem('deletePassword-' + id, deletePassword);

            const setInputCopy = (value, inputId, copyId) => {
                const deletePasswordInput = document.getElementById(inputId);
                deletePasswordInput.value = value;
                const deletePasswordCopy = document.getElementById(inputId + 'Copy');
                deletePasswordCopy.dataset.value = value;
            };
            const setURLQR = (value, inputBase) => {
                qrcode.toDataURL(value).then(dataURL => {
                    const img = document.getElementById(inputBase + 'QRCode');
                    img.src = dataURL;
                });
                setInputCopy(value, inputBase + 'URL');
            };
            setInputCopy(deletePassword, 'deletePassword');
            setURLQR(res.downloadURL, 'directDownload');
            setURLQR(res.downloadURL, 'firebaseInfo');
            setURLQR(res.downloadURL, 'firebaseWithPassword');

        }).catch(() => {
            alert('アップロードに失敗しました。');
        });
    });
    const onCopy = ({ target }) => {
        navigator.clipboard.writeText(target.dataset.value);
    };
    const copies = document.getElementsByClassName('copy');
    [...copies].forEach(element => {
        element.addEventListener('click', onCopy);
    });
});
