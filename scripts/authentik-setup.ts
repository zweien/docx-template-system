import { chromium, type Page } from 'playwright';

const AUTHENTIK_BASE = 'https://auth.idrl.top';
const LOGIN_URL = `${AUTHENTIK_BASE}/if/flow/default-authentication-flow/`;
const ADMIN_PROVIDERS = `${AUTHENTIK_BASE}/if/admin/#/core/providers`;
const ADMIN_APPLICATIONS = `${AUTHENTIK_BASE}/if/admin/#/core/applications`;
const CREATE_PROVIDER_URL = `${AUTHENTIK_BASE}/if/admin/#/core/providers/create/oauth2`;
const CREATE_APP_URL = `${AUTHENTIK_BASE}/if/admin/#/core/applications/create`;

const USERNAME = 'akadmin';
const PASSWORD = 'idrl123456';
const PROVIDER_NAME = 'docx-template-system';
const APP_NAME = 'IDRL填表系统';
const APP_SLUG = 'docx-template-system';
const REDIRECT_URI = 'https://doc.idrl.top/api/auth/callback/authentik';
const LAUNCH_URL = 'https://doc.idrl.top';

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForNetworkIdle(page: Page, timeout = 10000) {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch {
    // fallback: just wait a bit
    await sleep(2000);
  }
}

async function login(page: Page) {
  console.log('[1] 正在登录...');
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2000);

  // Fill username
  const uidInput = page.locator('input[name="uid_field"], input[placeholder*="user" i], input[placeholder*="Email" i], input[type="text"]').first();
  await uidInput.waitFor({ state: 'visible', timeout: 15000 });
  await uidInput.fill(USERNAME);
  console.log('  已输入用户名');

  // Click continue/next
  const continueBtn = page.locator('button[type="submit"]').first();
  await continueBtn.click();
  await sleep(2000);

  // Fill password
  const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.fill(PASSWORD);
  console.log('  已输入密码');

  // Click login/submit
  const loginBtn = page.locator('button[type="submit"]').first();
  await loginBtn.click();
  await sleep(3000);
  await waitForNetworkIdle(page);
  console.log('  登录成功');
}

async function checkProviderExists(page: Page): Promise<boolean> {
  console.log('[2] 检查 Provider 是否已存在...');
  await page.goto(ADMIN_PROVIDERS, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  await waitForNetworkIdle(page);

  // Look for provider in the table
  const content = await page.content();
  const exists = content.includes(PROVIDER_NAME);
  console.log(`  Provider "${PROVIDER_NAME}" ${exists ? '已存在' : '不存在'}`);
  return exists;
}

async function getProviderDetailUrl(page: Page): Promise<string | null> {
  // Navigate to providers list and find the link
  await page.goto(ADMIN_PROVIDERS, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  await waitForNetworkIdle(page);

  // Try to find a link or row containing our provider name
  const providerLink = page.locator(`a:has-text("${PROVIDER_NAME}"), td:has-text("${PROVIDER_NAME}")`).first();
  const count = await providerLink.count();
  if (count > 0) {
    // Try clicking on it
    try {
      await providerLink.click();
      await sleep(3000);
      await waitForNetworkIdle(page);
      return page.url();
    } catch {
      // try finding a nearby link
    }
  }
  return null;
}

async function createProvider(page: Page): Promise<{ clientId: string; clientSecret: string }> {
  console.log('[3] 创建 OAuth2 Provider...');
  await page.goto(CREATE_PROVIDER_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  await waitForNetworkIdle(page);

  // Take a screenshot to see the form
  await page.screenshot({ path: '/tmp/authentik-create-provider.png', fullPage: true });

  // Fill Name
  const nameInput = page.locator('input[name="name"], ak-text-input[name="name"]').first();
  await nameInput.waitFor({ state: 'visible', timeout: 15000 });
  await nameInput.fill(PROVIDER_NAME);
  console.log('  已填写 Name');

  // Fill Authorization flow - try to find and select
  const authFlowSelect = page.locator('select[name="authorizationFlow"], ak-select[name="authorizationFlow"]').first();
  if (await authFlowSelect.count() > 0) {
    // Select the first option that contains "authorization" or "implicit"
    const options = authFlowSelect.locator('option');
    const optionCount = await options.count();
    for (let i = 0; i < optionCount; i++) {
      const text = await options.nth(i).textContent() || '';
      if (text.toLowerCase().includes('implicit') || text.toLowerCase().includes('authorization')) {
        const value = await options.nth(i).getAttribute('value');
        if (value) {
          await authFlowSelect.selectOption(value);
          console.log(`  已选择 Authorization flow: ${text.trim()}`);
          break;
        }
      }
    }
  }

  // Fill Client type - should be "confidential" by default usually
  const clientTypeSelect = page.locator('select[name="clientType"]').first();
  if (await clientTypeSelect.count() > 0) {
    await clientTypeSelect.selectOption('confidential');
    console.log('  已设置 Client type: confidential');
  }

  // Fill Redirect URIs
  const redirectInput = page.locator('textarea[name="redirectUris"], input[name="redirectUris"], ak-text-input[name="redirectUris"]').first();
  if (await redirectInput.count() > 0) {
    await redirectInput.fill(REDIRECT_URI);
    console.log('  已填写 Redirect URI');
  }

  // Fill Scopes
  const scopesInput = page.locator('input[name="scopes"], ak-text-input[name="scopes"]').first();
  if (await scopesInput.count() > 0) {
    await scopesInput.fill('openid profile email');
    console.log('  已填写 Scopes');
  }

  await page.screenshot({ path: '/tmp/authentik-provider-filled.png', fullPage: true });

  // Click Create/Submit button
  const createBtn = page.locator('button[type="submit"]:has-text("Create"), button:has-text("Create"), ak-forms-submit button').first();
  await createBtn.click();
  console.log('  已点击 Create');
  await sleep(5000);
  await waitForNetworkIdle(page);

  await page.screenshot({ path: '/tmp/authentik-provider-created.png', fullPage: true });

  // Now we need to get Client ID and Client Secret
  // The page should redirect to the provider detail page or show the credentials
  const pageContent = await page.content();

  let clientId = '';
  let clientSecret = '';

  // Try to extract from page content
  const clientIdMatch = pageContent.match(/client[_\s]?id[^<]*?<[^>]*>([^<]+)/i) ||
    pageContent.match(/clientId["\s:]+["']?([a-zA-Z0-9]+)/);
  const clientSecretMatch = pageContent.match(/client[_\s]?secret[^<]*?<[^>]*>([^<]+)/i) ||
    pageContent.match(/clientSecret["\s:]+["']?([a-zA-Z0-9]+)/);

  if (clientIdMatch) clientId = clientIdMatch[1].trim();
  if (clientSecretMatch) clientSecret = clientSecretMatch[1].trim();

  // If we can't find them on this page, we need to navigate to the provider detail
  if (!clientId || !clientSecret) {
    console.log('  尝试从详情页获取凭据...');
    // The URL should now be on the edit/detail page
    const currentUrl = page.url();
    console.log(`  当前 URL: ${currentUrl}`);

    // Look for any text that looks like credentials
    const allText = await page.locator('body').innerText();
    console.log(`  页面文本 (前2000字符): ${allText.substring(0, 2000)}`);

    // Try to find client ID and secret in visible text
    const lines = allText.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.toLowerCase().includes('client id') || line.toLowerCase().includes('clientid')) {
        console.log(`  找到 Client ID 行: ${line}`);
      }
      if (line.toLowerCase().includes('client secret') || line.toLowerCase().includes('clientsecret')) {
        console.log(`  找到 Client Secret 行: ${line}`);
      }
    }
  }

  return { clientId, clientSecret };
}

async function getExistingProviderCredentials(page: Page): Promise<{ clientId: string; clientSecret: string }> {
  console.log('  获取已有 Provider 凭据...');

  // Navigate to providers list
  await page.goto(ADMIN_PROVIDERS, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  await waitForNetworkIdle(page);

  // Try to find and click on the provider row
  const allText = await page.locator('body').innerText();
  console.log(`  Provider 列表页面文本 (前1500字符): ${allText.substring(0, 1500)}`);

  // Look for a row with our provider name and click on it
  const providerRow = page.locator(`tr:has-text("${PROVIDER_NAME}"), a:has-text("${PROVIDER_NAME}")`).first();
  if (await providerRow.count() > 0) {
    await providerRow.click();
    await sleep(3000);
    await waitForNetworkIdle(page);
    console.log(`  点击后的 URL: ${page.url()}`);
  }

  await page.screenshot({ path: '/tmp/authentik-provider-detail.png', fullPage: true });

  // Now we should be on the detail/edit page
  const detailText = await page.locator('body').innerText();
  console.log(`  详情页文本 (前3000字符): ${detailText.substring(0, 3000)}`);

  // Also check the HTML for hidden fields
  const html = await page.content();
  const clientIdMatch = html.match(/client[_-]?id["\s:=]+["']?([a-zA-Z0-9_-]+)/i);
  const clientSecretMatch = html.match(/client[_-]?secret["\s:=]+["']?([a-zA-Z0-9_.-]+)/i);

  return {
    clientId: clientIdMatch ? clientIdMatch[1] : '',
    clientSecret: clientSecretMatch ? clientSecretMatch[1] : '',
  };
}

async function checkApplicationExists(page: Page): Promise<boolean> {
  console.log('[4] 检查 Application 是否已存在...');
  await page.goto(ADMIN_APPLICATIONS, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  await waitForNetworkIdle(page);

  const content = await page.content();
  const exists = content.includes(APP_SLUG) || content.includes(APP_NAME);
  console.log(`  Application "${APP_SLUG}" ${exists ? '已存在' : '不存在'}`);
  return exists;
}

async function createApplication(page: Page) {
  console.log('[5] 创建 Application...');
  await page.goto(CREATE_APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  await waitForNetworkIdle(page);

  await page.screenshot({ path: '/tmp/authentik-create-app.png', fullPage: true });

  // Fill Name
  const nameInput = page.locator('input[name="name"]').first();
  await nameInput.waitFor({ state: 'visible', timeout: 15000 });
  await nameInput.fill(APP_NAME);
  console.log(`  已填写 Name: ${APP_NAME}`);

  // Fill Slug
  const slugInput = page.locator('input[name="slug"]').first();
  if (await slugInput.count() > 0) {
    await slugInput.fill(APP_SLUG);
    console.log(`  已填写 Slug: ${APP_SLUG}`);
  }

  // Select Provider
  const providerSelect = page.locator('select[name="provider"]').first();
  if (await providerSelect.count() > 0) {
    const options = providerSelect.locator('option');
    const optionCount = await options.count();
    for (let i = 0; i < optionCount; i++) {
      const text = await options.nth(i).textContent() || '';
      if (text.includes(PROVIDER_NAME)) {
        const value = await options.nth(i).getAttribute('value');
        if (value) {
          await providerSelect.selectOption(value);
          console.log(`  已选择 Provider: ${text.trim()}`);
          break;
        }
      }
    }
  }

  // Fill Launch URL
  const launchUrlInput = page.locator('input[name="meta_launch_url"]').first();
  if (await launchUrlInput.count() > 0) {
    await launchUrlInput.fill(LAUNCH_URL);
    console.log(`  已填写 Launch URL: ${LAUNCH_URL}`);
  }

  await page.screenshot({ path: '/tmp/authentik-app-filled.png', fullPage: true });

  // Click Create
  const createBtn = page.locator('button[type="submit"]:has-text("Create"), button:has-text("Create")').first();
  await createBtn.click();
  console.log('  已点击 Create');
  await sleep(5000);
  await waitForNetworkIdle(page);

  await page.screenshot({ path: '/tmp/authentik-app-created.png', fullPage: true });
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  try {
    // Step 1: Login
    await login(page);

    // Verify login succeeded - check if we can access admin
    const currentUrl = page.url();
    console.log(`  登录后 URL: ${currentUrl}`);

    // Step 2: Check if provider exists
    const providerExists = await checkProviderExists(page);

    let clientId = '';
    let clientSecret = '';

    if (providerExists) {
      // Get existing credentials
      const creds = await getExistingProviderCredentials(page);
      clientId = creds.clientId;
      clientSecret = creds.clientSecret;
      console.log(`  已有 Provider 凭据 - Client ID: ${clientId}, Client Secret: ${clientSecret ? '***' : '未找到'}`);
    } else {
      // Step 3: Create provider
      const creds = await createProvider(page);
      clientId = creds.clientId;
      clientSecret = creds.clientSecret;
    }

    // Step 4: Check if application exists
    const appExists = await checkApplicationExists(page);

    if (!appExists) {
      // Step 5: Create application
      await createApplication(page);
    } else {
      console.log('[5] Application 已存在，跳过创建');
    }

    // Final report
    console.log('\n========== 结果 ==========');
    console.log(`Client ID: ${clientId}`);
    console.log(`Client Secret: ${clientSecret}`);
    console.log('==========================');

  } catch (err) {
    console.error('Error:', err);
    await page.screenshot({ path: '/tmp/authentik-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

main();
