const serverURL = new URL('https://fileuploader.nahsns.ga:10443/');

function byteToString(byte) {
    const size = Math.floor(Math.log2(byte) / 10);
    return (byte / (1 << size * 10)).toFixed(1) + ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'][size] ?? ` * 10 ^ ${size}`;
}

window.addEventListener('DOMContentLoaded', () => {
    const url = new URL(location.href);
    const id = url.searchParams.get('id');
    if (localStorage.getItem('deletePassword-' + id) === null && url.searchParams.get('password') !== null) {
        localStorage.setItem('deletePassword-' + id, url.searchParams.get('password'));
    }
    let deletePassword = localStorage.getItem('deletePassword-' + id);

    fetch(serverURL + id + '/info').then(res => res.json()).then(info => {
        const filename = document.getElementById('filename');
        const size = document.getElementById('size');

        const deleteButton = document.getElementById('delete');
        if (info.message) {
            filename.textContent = 'ファイルは存在しません。';
            size.textContent = '削除された可能性があります。';
            return;
        }
        filename.textContent = info.filename;
        size.textContent = byteToString(info.fileSize);

        deleteButton.hidden = false;
        deleteButton.addEventListener('click', () => {
            if (!deletePassword) {
                deletePassword = prompt('削除パスワードを入力してください。');
            }
            const result = confirm(`本当に${info.filename}を削除しますか？`);
            if (result) {
                const query = () => {
                    fetch(serverURL + id + '/', {
                        method: 'DELETE',
                        headers: {
                            Authorization: "Basic " + window.btoa('' + ":" + deletePassword),
                        }
                    }).then(res => {
                        if (res.ok) {
                            alert('削除しました。');
                            location.href = '/';
                        } else {
                            deletePassword = prompt('削除できませんでした。削除パスワードを入力してください。');
                            if (deletePassword) {
                                query();
                            }
                        }
                    });
                };
                query();
            }
        });
    });
});
