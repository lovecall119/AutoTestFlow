const { test, expect } = require('@playwright/test');

test('F079007M_Save', async ({ page }) => {
    // 1. Go to the specific URL
    const targetUrl = 'https://ap02.domino.com.tw/FCB/EFormTOM.nsf/XF079007M.xsp';
    await page.goto(targetUrl);

    // 2. Handle Login if redirected to login page
    // Using selectors based on previous project knowledge (#user-id, #pw-id)
    const userInput = page.locator('#user-id');
    if (await userInput.count() > 0 && await userInput.isVisible()) {
        console.log('Login page detected. Performing login...');
        await userInput.fill('user01');
        await page.locator('#pw-id').fill('Zxc123');
        await page.locator('input[type="submit"]').click();

        // Wait for navigation back to the target or next page
        await page.waitForLoadState('networkidle');
    } else {
        console.log('Login fields not found. Already logged in or different page structure?');
    }

    // 3. Validation / Verification
    console.log(`Current Page Title: ${await page.title()}`);
    console.log(`Current URL: ${page.url()}`);

    // Ensure we are somewhat loaded
    await expect(page).toHaveURL(/.*XF079007M.xsp.*/);

    // 4. Dynamic Form Filling (Respecting U_hide)
    console.log('--- Starting Dynamic Form Fill ---');
    await page.waitForTimeout(2000); // Wait for scripts to initialize form

    const fillContext = async (context, contextName) => {
        return await context.evaluate((name) => {
            const isUHide = (el) => el.closest('.U_hide') !== null;
            const isVisible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

            const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select');
            let count = 0;

            for (const el of inputs) {
                // RULE: Any field inside .U_hide is hidden, DO NOT fill.
                if (isUHide(el)) continue;

                // Standard visibility check
                if (!isVisible(el)) continue;

                // Interactable check
                if (el.readOnly || el.disabled) continue;

                try {
                    // Logic based on type
                    if (el.tagName === 'SELECT') {
                        if (el.options.length > 1) {
                            el.selectedIndex = 1; // Pick second option
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            count++;
                        }
                    } else if (el.type === 'checkbox' || el.type === 'radio') {
                        if (!el.checked) {
                            el.checked = true;
                            el.dispatchEvent(new Event('click', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            count++;
                        }
                    } else {
                        // Text, Number, Date, etc.
                        const ts = new Date().toISOString().split('T')[1].split('.')[0]; // HH:mm:ss

                        // Helper to guess field meaning
                        const getContextText = (input) => {
                            let text = (input.getAttribute('title') || '') +
                                (input.getAttribute('name') || '') +
                                (input.id || '') +
                                (input.getAttribute('placeholder') || '');
                            // Check Labels
                            if (input.labels && input.labels.length > 0) {
                                text += Array.from(input.labels).map(l => l.innerText).join(' ');
                            }
                            // Check Table Row (common in legacy forms)
                            const row = input.closest('tr');
                            if (row) text += row.innerText;
                            return text;
                        };

                        const contextText = getContextText(el);

                        if (contextText.includes('分機')) {
                            // Numeric for Extension
                            el.value = String(Math.floor(1000 + Math.random() * 9000));
                        } else if (contextText.includes('主旨') || contextText.includes('呈核主旨')) {
                            // Specific Subject format
                            const dateStr = new Date().toLocaleString('zh-TW', { hour12: false });
                            el.value = `[測試執行時間: ${dateStr}] 系統自動填寫主旨`;
                        } else {
                            // Default Random Text
                            el.value = `Auto_${ts}_${Math.floor(Math.random() * 100)}`;
                        }

                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        el.dispatchEvent(new Event('blur', { bubbles: true }));
                        count++;
                    }
                    // Visual debug highlight
                    el.style.border = '2px solid #00f';
                } catch (e) {
                    console.error(`Error filling element in ${name}:`, e);
                }
            }
            return count;
        }, contextName);
    };

    // Execute on Main Main Frame and all Child Frames
    let totalFilled = 0;

    // Main Frame
    totalFilled += await fillContext(page, 'Main Page');

    // Child Frames
    for (const frame of page.frames()) {
        if (frame === page.mainFrame()) continue;
        try {
            totalFilled += await fillContext(frame, `Frame: ${frame.url()}`);
        } catch (e) {
            console.log(`Could not access frame: ${frame.url()}`);
        }
    }

    console.log(`Dynamic Fill Complete. Total fields filled: ${totalFilled}`);

    // 6. Write Counter-sign Info (Optional but recommended if present)
    const writeInfoBtn = page.locator('button, a.btn').filter({ hasText: '寫入會簽資訊' }).first();
    if (await writeInfoBtn.isVisible()) {
        console.log('Found "寫入會簽資訊" button. Clicking...');
        await writeInfoBtn.click();
        await page.waitForTimeout(1000);
    }

    // 6.5 Highlight Specific Buttons before Save
    // 6.5 Handle Complex Dialog Selections (Red, Orange, Yellow, Green)
    console.log('--- Starting Complex Dialog Interactions ---');

    const selectionTasks = [
        {
            name: 'Red Task (數位銀行處)',
            suffix: ':CounterSignBtn_L3',
            category: '24.資訊管理中心',
            target: '數位銀行處'
        },
        {
            name: 'Orange Task (系統整合部)',
            suffix: ':CounterSignBtn_L4',
            category: null, // Auto-selected
            target: '系統整合部'
        },
        {
            name: 'Yellow Task (數位安全處)',
            suffix: ':CT2CounterSignBtn_L3',
            category: '24.資訊管理中心',
            target: '數位安全處'
        },
        {
            name: 'Green Task (應用開發一部)',
            suffix: ':CT2CounterSignBtn_L4',
            category: null, // Auto-selected
            target: '應用開發一部'
        }
    ];

    // Set longer timeout for this specific test due to multiple dialog interactions
    test.setTimeout(60000);

    // Helper function for the entire dialog flow
    const handleComplexDialog = async (task) => {
        console.log(`\n=== Starting Task: ${task.name} ===`);

        // 1. Find and Click Button (Slowly)
        const btnSelector = `[id$="${task.suffix}"]`;
        let btn = page.locator(btnSelector).first();

        // Search frames if not on main page
        if (!await btn.isVisible()) {
            for (const frame of page.frames()) {
                const fb = frame.locator(btnSelector).first();
                if (await fb.isVisible()) {
                    btn = fb;
                    break;
                }
            }
        }

        if (!await btn.isVisible()) {
            console.error(`CRITICAL: Button for ${task.name} not found!`);
            return;
        }

        // Visual Highlight + Slow Click
        await btn.scrollIntoViewIfNeeded();
        await btn.evaluate(el => el.style.border = '3px solid blue');
        await page.waitForTimeout(1000); // 1s delay before open
        await btn.click();
        console.log('Dialog Button Clicked. Waiting 0.5s for dialog content...');
        await page.waitForTimeout(500);

        // 2. Interact inside Dialog
        // We need to find the "Category" ListBox and "Target" ListBox
        // Dialog might be in the same context or a new iframe. We scan all.

        let categoryFound = false;

        // Function to select category
        const selectCategory = async (ctx) => {
            const selects = ctx.locator('select:visible');
            const count = await selects.count();
            for (let i = 0; i < count; i++) {
                const s = selects.nth(i);
                // Check options
                const opts = await s.locator('option').allInnerTexts();
                const matched = opts.find(o => o.includes(task.category));

                // If found, ensure it is selected
                if (matched) {
                    console.log(`  [Select Category] Found '${matched}' in listbox.`);
                    await s.scrollIntoViewIfNeeded();
                    await page.waitForTimeout(500); // Slow scroll
                    await s.selectOption({ label: matched });
                    await page.waitForTimeout(2000); // Wait for right side to update
                    return true;
                }
            }
            return false;
        };

        if (task.category) {
            // Try to find and select Category in all frames
            if (await selectCategory(page)) categoryFound = true;
            else {
                for (const f of page.frames()) {
                    if (await selectCategory(f)) {
                        categoryFound = true;
                        break;
                    }
                }
            }
            if (!categoryFound) console.log(`  [Info] Category '${task.category}' not found or auto-selected.`);
        } else {
            console.log('  [Info] Skipping Category selection (Auto-mode).');
        }

        console.log('  [Info] Waiting 1s before selecting target (due to slow dialog)...');
        await page.waitForTimeout(1000);

        // 3. Select Target (Double Click)
        let targetSelected = false;

        const selectTargetItem = async (ctx) => {
            const selects = ctx.locator('select:visible');
            const count = await selects.count();
            for (let i = 0; i < count; i++) {
                const s = selects.nth(i);
                const opts = await s.locator('option').allInnerTexts();
                // Find target
                const matched = opts.find(o => o.includes(task.target));

                if (matched) {
                    console.log(`  [Select Target] Found '${matched}' in listbox.`);
                    await s.scrollIntoViewIfNeeded();
                    await page.waitForTimeout(500);

                    // A. Select it
                    await s.selectOption({ label: matched });
                    await page.waitForTimeout(500);

                    // B. Double Click (Try Element handle first)
                    const opt = s.locator('option').filter({ hasText: matched }).first();
                    if (await opt.isVisible()) {
                        console.log('    Double-clicking option element...');
                        await opt.dblclick({ force: true });
                    } else {
                        // Fallback: Dispatch event on select
                        console.log('    Dispatching dblclick event on select...');
                        await s.dispatchEvent('dblclick');
                    }

                    await page.waitForTimeout(1000);

                    // C. Click "Add" button if exists (Legacy behavior)
                    const addBtn = ctx.locator('button').filter({ hasText: '>' }).or(ctx.locator('button').filter({ hasText: '新增' })).first();
                    if (await addBtn.isVisible()) {
                        await addBtn.click();
                        console.log('    Clicked [Add/>/新增] button.');
                        await page.waitForTimeout(1000);
                    }
                    return true;
                }
            }
            return false;
        };

        // Scan for target
        if (await selectTargetItem(page)) targetSelected = true;
        else {
            for (const f of page.frames()) {
                if (await selectTargetItem(f)) { targetSelected = true; break; }
            }
        }

        if (!targetSelected) {
            console.error(`  [ERROR] Target '${task.target}' NOT FOUND in any listbox.`);
            await page.screenshot({ path: `screenshots/error_${task.name}.png`, fullPage: true });
        }

        // 4. Confirm / Close Dialog
        console.log('  [Confirm] Finding OK button...');
        // Common Confirm Selectors
        const confirmFilter = { hasText: /^確定$/ };

        let confirmClicked = false;

        // Try global search (dialog often floats on top)
        const globalConfirm = page.locator('button, input[type="button"], span').filter(confirmFilter);

        if (await globalConfirm.count() > 0) {
            // Iterate to find the visible one
            const count = await globalConfirm.count();
            for (let i = 0; i < count; i++) {
                const btn = globalConfirm.nth(i);
                if (await btn.isVisible()) {
                    await btn.scrollIntoViewIfNeeded();
                    await page.waitForTimeout(500);
                    await btn.click();
                    confirmClicked = true;
                    console.log('  [Confirm] Button Clicked.');
                    break;
                }
            }
        }

        if (!confirmClicked) console.error('  [Confirm] Button NOT FOUND or NOT CLICKABLE.');

        await page.waitForTimeout(2000); // Wait for dialog close animation
    };

    // Execute All 4 Tasks Sequentially
    for (const task of selectionTasks) {
        await handleComplexDialog(task);
    }

    // 7. Submit / Save
    console.log('--- Submitting Form ---');

    // Capture state before save
    await page.screenshot({ path: 'before_save.png' });
    console.log('Screenshot saved: before_save.png');

    // Handle Dialogs (Alerts/Confirmations)
    page.on('dialog', async dialog => {
        console.log(`[DIALOG DETECTED] Type: ${dialog.type()}, Message: ${dialog.message()}`);
        await dialog.accept();
        console.log('Dialog accepted.');
    });

    // Strategy from tom_general.spec.js: use text filter '儲存'
    // Also try to find it in frames if main page fails
    const findSaveBtn = (context) => context.locator('button, input[type="button"]').filter({ hasText: '儲存' }).first();

    let saveClicked = false;
    const mainSave = findSaveBtn(page);

    if (await mainSave.isVisible()) {
        console.log('Found "儲存" button on Main Page (by text).');

        // Visual Verification: Turn Green & Wait
        await mainSave.evaluate(el => {
            el.style.backgroundColor = '#00FF00'; // Bright Green
            el.style.border = '5px solid red';    // Red Border
            el.scrollIntoView({ block: 'center', inline: 'center' });
        });
        await page.waitForTimeout(1000);

        await mainSave.click();
        saveClicked = true;
    } else {
        console.log('Save (text) not found on main page. Checking frames...');
        for (const frame of page.frames()) {
            const frameSave = findSaveBtn(frame);
            if (await frameSave.isVisible()) {
                console.log(`Found "儲存" button in frame: ${frame.url()}`);

                // Visual Verification: Turn Green & Wait
                await frameSave.evaluate(el => {
                    el.style.backgroundColor = '#00FF00'; // Bright Green
                    el.style.border = '5px solid red';    // Red Border
                    el.scrollIntoView({ block: 'center', inline: 'center' });
                });
                await page.waitForTimeout(1000);

                await frameSave.click();
                saveClicked = true;
                break;
            }
        }
    }

    if (!saveClicked) {
        // Fallback to ID selector if text failed
        console.log('Text filter failed. Trying ID selector ending in :button1...');
        const idSelector = 'button[id$=":button1"], input[type="button"][id$=":button1"]';
        const mainSaveId = page.locator(idSelector).first();
        if (await mainSaveId.isVisible()) {
            // Visual Verification
            await mainSaveId.evaluate(el => {
                el.style.backgroundColor = '#00FF00';
                el.style.border = '5px solid red';
            });
            await page.waitForTimeout(1000);

            await mainSaveId.click();
            console.log('Clicked "儲存" button via ID selector.');
            saveClicked = true;
        } else {
            for (const frame of page.frames()) {
                const fs = frame.locator(idSelector).first();
                if (await fs.isVisible()) {
                    // Visual Verification
                    await fs.evaluate(el => {
                        el.style.backgroundColor = '#00FF00';
                        el.style.border = '5px solid red';
                    });
                    await page.waitForTimeout(1000);

                    await fs.click();
                    console.log('Clicked "儲存" button via ID selector in frame.');
                    saveClicked = true;
                    break;
                }
            }
        }
    }

    if (!saveClicked) {
        console.error('CRITICAL: Save button (by text or ID) NOT FOUND in any frame or main page.');
    }

    // Wait for operation to complete and capture result
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'after_save.png' });
    console.log('Screenshot saved: after_save.png');
    console.log(`Final URL: ${page.url()}`);
});
