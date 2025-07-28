// t.js
const { chromium } = require('playwright');
const fs = require('fs').promises;
const minimist = require('minimist');

// 解析命令行参数
const argv = minimist(process.argv.slice(2));
const customIterations = argv.iterations || argv.i;

// 默认循环次数
const defaultIterations = 1;
const iterations = (typeof customIterations === 'number' && customIterations > 0)
  ? customIterations
  : (parseInt(customIterations) > 0 ? parseInt(customIterations) : defaultIterations);

console.log(`本次将循环执行 ${iterations} 次`);

(async () => {
  for (let i = 0; i < iterations; i++) {
    console.log(`\n========== 第 ${i + 1} 次循环 ==========\n`);
    let browser;
    try {
      const userDataDir = 'C:\\Users\\sandy\\Desktop\\t\\lumao_Chrome\\lumao1';
      const okxExtPath = 'C:\\Users\\sandy\\Desktop\\t\\mcohilncbfahbmgdjkbpemcciiolgcge\\3.64.0_0';
      const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

      // Option 1: Launch browser with OKX plugin (recommended)
      console.log('启动浏览器...');
      browser = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        executablePath: chromePath,
        args: [
          `--disable-extensions-except=${okxExtPath}`,
          `--load-extension=${okxExtPath}`,
        ],
      });

      // Option 2: Connect to existing Chrome instance
      /*
      async function connectWithRetry(maxRetries = 3, delay = 2000) {
        for (let i = 0; i < maxRetries; i++) {
          try {
            const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
            console.log('连接到现有 Chrome 实例');
            return browser;
          } catch (error) {
            console.log(`连接尝试 ${i + 1} 失败: ${error.message}`);
            if (i < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        throw new Error('多次尝试后无法连接到 Chrome');
      }
      browser = await connectWithRetry();
      */

      // 2. 检查并处理 OKX 插件解锁页面
      console.log('检查 OKX 插件页面...');
      await new Promise(resolve => setTimeout(resolve, 10000)); // 等待更久
      let unlockPage = null;
      for (const p of browser.pages()) {
        const url = p.url();
        const title = await p.title().catch(() => '');
        console.log(`检查页面: URL=${url}, Title=${title}`);
        if (url.includes('chrome-extension')) {
          unlockPage = p;
          // 不 break，全部打印出来
        }
      }

      if (unlockPage) {
        console.log(`检测到插件页面: ${unlockPage.url()}`);
        // 直接尝试自动解锁
        try {
          await unlockPage.waitForLoadState('domcontentloaded', { timeout: 20000 });
          await unlockPage.screenshot({ path: 'unlock_page.png' });
          await handleUnlock(unlockPage);
        } catch (error) {
          console.error('初始解锁失败:', error);
          await unlockPage.screenshot({ path: 'unlock_page_error.png' });
          await unlockPage.content().then(html => fs.writeFile('unlock_page_error.html', html));
          // 不关闭浏览器
        }
      } else {
        console.log('未检测到插件页面，检查 OKX 插件是否正确加载');
      }

      // 3. 获取或创建主页面
      let page = browser.pages().find(p => !p.url().includes('chrome-extension')) || (await browser.newPage());

      // 4. 访问 Rooster Protocol 页面并执行操作
      try {
        await page.setViewportSize({ width: 800, height: 600 });
        console.log('正在导航到 Rooster Protocol 页面...');
        await page.setExtraHTTPHeaders({
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        });
        const response = await page.goto(
          'https://www.rooster-protocol.com/swap?tokenA=PLUME&tokenB=0xEa237441c92CAe6FC17Caaf9a7acB3f953be4bd1',
          { timeout: 60000, waitUntil: 'domcontentloaded' }
        );

        // 检查 HTTP 状态码
        const status = response ? response.status() : null;
        console.log(`页面状态码: ${status}`);
        if (status && status >= 400) {
          throw new Error(`页面加载失败，状态码: ${status}`);
        }

        // 保存页面截图和 HTML
        await page.screenshot({ path: 'page_load.png' });
        const html = await page.content();
        await fs.writeFile('page_load.html', html);
        console.log('页面加载完成，截图保存为 page_load.png，HTML 保存为 page_load.html');

        // 等待 PLUME 文本
        console.log('等待 PLUME 文本...');
        try {
          await page.waitForSelector('text=/PLUME/i', { timeout: 30000 });
          console.log('PLUME 文本已找到');
        } catch (error) {
          console.error('未找到 PLUME 文本:', error);
          await page.screenshot({ path: 'plume_error.png' });
          throw error;
        }

        // 检查并点击“连接钱包”按钮
        console.log('检查是否需要连接钱包...');
        const connectWalletButton = await page.locator('text=Connect Wallet, text=连接钱包').first();
        if (await connectWalletButton.count() > 0) {
          console.log('检测到连接钱包按钮，正在点击...');
          await connectWalletButton.click();
          try {
            await page.waitForSelector('text=/OKX/i', { timeout: 10000 });
            await page.locator('text=/OKX/i').click();
            console.log('已选择 OKX 钱包');
            await page.waitForTimeout(5000);
            await page.screenshot({ path: 'post_connect_wallet.png' });
          } catch (error) {
            console.error('钱包连接失败:', error);
            await page.screenshot({ path: 'connect_wallet_error.png' });
          }
        } else {
          console.log('未检测到连接钱包按钮，假设已连接');
        }

        // 等待输入框
        console.log('等待输入框...');
        const input = await page.locator('input[type="text"]').first();
        await input.waitFor({ state: 'visible', timeout: 20000 });
        await input.click({ clickCount: 3 });
        await page.keyboard.type('0.01', { delay: 100 });
        console.log('金额输入完成');
        await page.waitForTimeout(10000); // 等待 10 秒确保按钮加载
        await page.screenshot({ path: 'post_amount_input.png' });

        // 调试：打印页面所有按钮的文本
        console.log('列出页面上所有按钮的文本...');
        const buttons = await page.locator('button').all();
        for (const btn of buttons) {
          const text = await btn.textContent();
          const disabled = await btn.isDisabled();
          const visible = await btn.isVisible();
          console.log(`按钮: text="${text?.trim()}", disabled=${disabled}, visible=${visible}`);
        }

        // 点击第一个按钮（Wrap）
        const firstButtonXPath = '//*[@id="root"]/div/div/div[1]/div/div[1]/div/div[2]/div[2]/button';
        console.log('等待第一个按钮（Wrap）...');
        let firstButton = await page.locator('text=Wrap').first();
        if (await firstButton.count() === 0) {
          console.log('未找到 "Wrap" 按钮，尝试 XPath...');
          firstButton = await page.locator(`xpath=${firstButtonXPath}`).first();
        }
        if (await firstButton.count() === 0) {
          throw new Error('无法定位第一个按钮（Wrap）');
        }
        await firstButton.waitFor({ state: 'visible', timeout: 20000 });
        const firstButtonText = await firstButton.textContent();
        const firstButtonDisabled = await firstButton.isDisabled();
        console.log(`第一个按钮: text="${firstButtonText?.trim()}", disabled=${firstButtonDisabled}`);
        await firstButton.click({ force: true });
        console.log('第一个按钮（Wrap）点击完成');
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'post_first_button.png' });

        // 点击第二个按钮（Confirm Wrap）
        const secondButtonXPath = '//*[@id="root"]/div/div/div[1]/div/div[1]/div/div[2]/div[3]/button';
        console.log('等待第二个按钮（Confirm Wrap）...');
        let secondButton = await page.locator('text=Swap, text=Confirm, text=确认, text=Confirm Wrap').first();
        if (await secondButton.count() === 0) {
          console.log('未找到 "Swap/Confirm/确认/Confirm Wrap" 按钮，尝试 XPath...');
          secondButton = await page.locator(`xpath=${secondButtonXPath}`).first();
        }
        if (await secondButton.count() === 0) {
          throw new Error('无法定位第二个按钮（Confirm Wrap）');
        }
        await secondButton.waitFor({ state: 'visible', timeout: 20000 });
        const secondButtonText = await secondButton.textContent();
        const secondButtonDisabled = await secondButton.isDisabled();
        console.log(`第二个按钮: text="${secondButtonText?.trim()}", disabled=${secondButtonDisabled}`);
        await secondButton.click({ force: true });
        console.log('第二个按钮（Confirm Wrap）点击完成');
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'post_second_button.png' });
      } catch (error) {
        console.error('页面操作失败:', error);
        await page.screenshot({ path: 'page_error.png' });
        // 不关闭浏览器
      }

      // 5. 处理 OKX 插件弹窗
      try {
        console.log('等待 OKX 插件弹窗...');
        let okxPopup = null;
        const existingPages = browser.pages().filter(p => p.url().includes('chrome-extension'));
        if (existingPages.length > 0) {
          okxPopup = existingPages[0];
          console.log('使用现有 OKX 页面:', okxPopup.url());
          // 等待页面更新，检测风险提示或确认元素
          await okxPopup.waitForFunction(
            () => document.querySelector('div._extButton_1qpa2_79') || document.querySelector('button, [role=button]'),
            { timeout: 120000 }
          ).catch((err) => console.log('等待页面更新失败:', err.message));
        } else {
          try {
            [okxPopup] = await Promise.all([
              browser.waitForEvent('page', { timeout: 120000 }),
            ]);
            console.log('检测到新 OKX 插件弹窗:', okxPopup.url());
          } catch (error) {
            console.log('未捕获新页面，检查现有页面...');
            for (const p of browser.pages()) {
              const url = p.url();
              if (url.includes('chrome-extension')) {
                okxPopup = p;
                console.log('找到现有 OKX 页面:', url);
                break;
              }
            }
          }
        }

        if (!okxPopup) {
          throw new Error('未找到 OKX 插件弹窗页面');
        }

        await okxPopup.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => console.log('页面加载超时'));
        await okxPopup.screenshot({ path: 'popup_page.png' });
        const popupHtml = await okxPopup.content();
        await fs.writeFile('popup_page.html', popupHtml);
        console.log('OKX 弹窗加载完成:', okxPopup.url());

        // 调试：列出所有按钮和可点击元素
        console.log('列出弹窗上的所有按钮和可点击元素...');
        const clickableElements = await okxPopup.locator('button, [role=button], div[role=button]').all();
        for (const el of clickableElements) {
          const text = await el.textContent();
          const disabled = await el.isDisabled();
          const visible = await el.isVisible();
          console.log(`元素: text="${text?.trim()}", disabled=${disabled}, visible=${visible}`);
        }

        // 处理风险提示页面
        console.log('检查并处理风险提示页面...');
        const networkConfirm = await okxPopup.locator('div._extButton_1qpa2_79').first();
        if (await networkConfirm.count() > 0) {
          await networkConfirm.waitFor({ state: 'visible', timeout: 30000 });
          await networkConfirm.click();
          console.log('点击 “网络正确，继续交易”');
          await okxPopup.waitForTimeout(3000);
          await okxPopup.screenshot({ path: 'post_network_confirm.png' });
        } else {
          console.log('未检测到风险提示页面');
        }

        // 等待交易确认界面
        console.log('等待交易确认界面...');
        let confirmElement = null;
        try {
          confirmElement = await okxPopup.locator('button, [role=button]').filter({
            hasText: /Confirm|确认|Approve|Sign|Sign Transaction|Confirm Transaction|Approve Transaction/i
          }).first();
          await confirmElement.waitFor({ state: 'visible', timeout: 120000 });
          console.log('检测到交易确认按钮，等待 10 秒...');
          await okxPopup.waitForTimeout(10000); // 初始 10 秒等待
          await confirmElement.click();
          console.log('交易确认按钮点击完成，等待确认完成...');
          await okxPopup.waitForTimeout(20000); // 20 秒等待确认完成
          await okxPopup.screenshot({ path: 'post_confirm.png' });
          // 尝试检测弹窗是否关闭
          await okxPopup.waitForTimeout(5000).catch(() => console.log('弹窗可能已关闭'));
        } catch (error) {
          console.error('交易确认失败:', error);
          await okxPopup.screenshot({ path: 'confirm_error.png' }).catch(() => {});
        }

        // 返回主页面，检查 "Done" 按钮
        console.log('返回主页面，等待交易完成...');
        await page.bringToFront(); // 切换回主页面
        await page.waitForTimeout(10000); // 等待 10 秒，确保交易状态更新
        await page.reload({ waitUntil: 'domcontentloaded' }); // 刷新页面以更新状态
        await page.screenshot({ path: 'post_transaction_page.png' });

        // 等待并点击 "Done" 按钮
        console.log('等待并点击 "Done" 按钮...');
        let doneButton = null;
        try {
          doneButton = await page.locator('button.MuiButton-fullWidth').filter({ hasText: "Done" }).first();
          // 仅检查按钮是否存在，不依赖 waitFor 可见性
          if (await doneButton.count() > 0) {
            await doneButton.click();
            console.log('"Done" 按钮点击完成');
            await page.screenshot({ path: 'post_done.png' });
          } else {
            console.log('未找到 "Done" 按钮，跳过点击');
          }
        } catch (error) {
          console.error('点击 "Done" 按钮失败:', error);
          await page.screenshot({ path: 'done_error.png' }).catch(() => {});
        } finally {
          // 记录点击后的页面状态
          console.log('确认 "Done" 按钮点击后页面状态...');
          const postClickButtons = await page.locator('button').all();
          for (const btn of postClickButtons) {
            const text = await btn.textContent();
            const disabled = await btn.isDisabled();
            const visible = await btn.isVisible();
            console.log(`点击后按钮: text="${text?.trim()}", disabled=${disabled}, visible=${visible}`);
          }
        }
      } catch (error) {
        console.error('处理 OKX 弹窗失败:', error);
        if (okxPopup) {
          await okxPopup.screenshot({ path: 'popup_error.png' }).catch(() => {});
        } else {
          await page.screenshot({ path: 'popup_error.png' }).catch(() => {}); // 如果 okxPopup 无效，使用 page
        }
        // 不关闭浏览器
      }

      // 6. 观察结果
      await page.waitForTimeout(2000).catch(() => console.log('等待超时'));

      // 7. 关闭浏览器
      await browser.close();
      console.log('浏览器已关闭');
    } catch (error) {
      console.error('脚本失败:', error);
      if (browser) {
        await browser.close().catch(() => {}); // 防止关闭失败
      }
    }
    // 每次循环间隔2秒
    if (i < iterations - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
})();

// 解锁逻辑
async function handleUnlock(page) {
  try {
    let inputSelector = 'input[data-testid="okd-input"], input[type="password"], input';
    const input = await page.locator(inputSelector).first();
    if (await input.count() === 0) {
      throw new Error('无法定位密码输入框');
    }

    console.log(`找到输入框，使用选择器: ${inputSelector}`);
    await input.waitFor({ state: 'visible', timeout: 20000 });
    await input.click({ force: true });
    await input.focus();
    const password = process.env.OKX_PASSWORD || '123456';
    await page.keyboard.type(password, { delay: 100 });
    console.log('密码输入完成');

    // 调试：列出所有按钮
    console.log('列出解锁页面上的所有按钮...');
    const buttons = await page.locator('button').all();
    for (const btn of buttons) {
      const text = await btn.textContent();
      const disabled = await btn.isDisabled();
      const visible = await btn.isVisible();
      console.log(`按钮: text="${text?.trim()}", disabled=${disabled}, visible=${visible}`);
    }

    let buttonSelector = '[data-testid="okd-button"]';
    let button = await page.locator(buttonSelector).first();
    if (await button.count() === 0) {
      console.log('未找到 [data-testid="okd-button"]，尝试文本选择器...');
      buttonSelector = 'text=确认, text=Unlock';
      button = await page.locator(buttonSelector).first();
    }
    if (await button.count() === 0) {
      throw new Error('无法定位确认按钮');
    }

    await button.waitFor({ state: 'visible', timeout: 10000 });
    await button.click();
    console.log('点击解锁按钮');
    await page.waitForTimeout(3000);
    console.log('解锁完成');
  } catch (error) {
    throw new Error(`解锁失败: ${error.message}`);
  }
}
