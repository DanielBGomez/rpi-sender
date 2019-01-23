const fs = require('fs');
const webdriver = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const chromium = require('chromium');
require('chromedriver');

async function start() {
    let options = new chrome.Options();
    options.setChromeBinaryPath(chromium.path);
    options.addArguments('--headless');
    options.addArguments("--no-sandbox");
    options.addArguments("--disable-dev-shm-usage");
    // options.addArguments('--disable-gpu');
    // options.addArguments('--window-size=1280,960');

    const driver = await new webdriver.Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
		
    await driver.get('https://webrtc.owldigitaldesign.com/sender');
    // await takeScreenshot(driver, 'google-start-page');
    console.log('Connected')
    driver.executeAsyncScript(() => {
        var callback = arguments[ arguments.length - 1 ];

        callback(JSON.stringify(stream))
    }).then(res => console.log(res))
    
    setTimeout(async () => {
        console.log('Closing')
        await driver.quit();
    }, 1000)
}

async function takeScreenshot(driver, name) {
	await driver.takeScreenshot().then((data) => {
        fs.writeFileSync(name + '.png', data, 'base64');
        console.log('Screenshot is saved');
    });
}

start();