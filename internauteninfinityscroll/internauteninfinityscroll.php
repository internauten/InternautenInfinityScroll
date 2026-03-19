<?php
/**
 * PrestaShop module: Infinite scroll for product listings.
 */
if (!defined('_PS_VERSION_')) {
    exit;
}

class Internauteninfinityscroll extends Module
{
    private const CONF_BATCH_SIZE = 'IIS_BATCH_SIZE';
    private const CONF_THEME_PROFILE = 'IIS_THEME_PROFILE';
    private const CONF_PRODUCT_LIST_SELECTORS = 'IIS_PRODUCT_LIST_SELECTORS';
    private const CONF_PRODUCT_ITEM_SELECTOR = 'IIS_PRODUCT_ITEM_SELECTOR';
    private const CONF_NEXT_LINK_SELECTORS = 'IIS_NEXT_LINK_SELECTORS';
    private const CONF_PAGINATION_SELECTORS = 'IIS_PAGINATION_SELECTORS';
    private const CONF_DEBUG_LOGS = 'IIS_DEBUG_LOGS';

    public function __construct()
    {
        $this->name = 'internauteninfinityscroll';
        $this->tab = 'front_office_features';
        $this->version = '0.0.2';
        $this->author = 'die.internauten.ch';
        $this->need_instance = 0;
        $this->bootstrap = false;

        $this->ps_versions_compliancy = [
            'min' => '1.7.0.0',
            'max' => _PS_VERSION_,
        ];

        parent::__construct();

        $this->displayName = $this->l('Internauten Infinity Scroll');
        $this->description = $this->l('Loads additional products automatically when users reach the end of product lists.');
    }

    public function install()
    {
        return parent::install()
            && $this->installConfiguration()
            && $this->registerHook('actionFrontControllerSetMedia');
    }

    public function uninstall()
    {
        return $this->uninstallConfiguration()
            && parent::uninstall();
    }

    public function getContent()
    {
        $output = '';

        if (Tools::isSubmit('submit' . $this->name)) {
            $batchSize = (int) Tools::getValue(self::CONF_BATCH_SIZE, 20);
            if ($batchSize < 1) {
                $batchSize = 1;
            }

            if ($batchSize > 100) {
                $batchSize = 100;
            }

            $themeProfile = (string) Tools::getValue(self::CONF_THEME_PROFILE, 'auto');
            $availableProfiles = array_keys($this->getThemeSelectorProfiles());
            if (!in_array($themeProfile, $availableProfiles, true)) {
                $themeProfile = 'auto';
            }

            Configuration::updateValue(self::CONF_BATCH_SIZE, $batchSize);
            Configuration::updateValue(self::CONF_THEME_PROFILE, $themeProfile);
            Configuration::updateValue(
                self::CONF_PRODUCT_LIST_SELECTORS,
                $this->sanitizeSelectorMultiline((string) Tools::getValue(self::CONF_PRODUCT_LIST_SELECTORS, ''))
            );
            Configuration::updateValue(
                self::CONF_PRODUCT_ITEM_SELECTOR,
                trim((string) Tools::getValue(self::CONF_PRODUCT_ITEM_SELECTOR, ''))
            );
            Configuration::updateValue(
                self::CONF_NEXT_LINK_SELECTORS,
                $this->sanitizeSelectorMultiline((string) Tools::getValue(self::CONF_NEXT_LINK_SELECTORS, ''))
            );
            Configuration::updateValue(
                self::CONF_PAGINATION_SELECTORS,
                $this->sanitizeSelectorMultiline((string) Tools::getValue(self::CONF_PAGINATION_SELECTORS, ''))
            );
            Configuration::updateValue(self::CONF_DEBUG_LOGS, (int) Tools::getValue(self::CONF_DEBUG_LOGS, 0));

            $output .= $this->displayConfirmation($this->l('Settings updated.'));
        }

        $output .= $this->renderForm();

        return $output;
    }

    public function hookActionFrontControllerSetMedia(array $params)
    {
        if (!$this->isProductListingPage()) {
            return;
        }

        $controller = $this->context->controller;
        if (!is_object($controller)) {
            return;
        }

        $controller->registerJavascript(
            'module-' . $this->name . '-infinite-scroll',
            'modules/' . $this->name . '/views/js/infinite-scroll.js',
            [
                'position' => 'bottom',
                'priority' => 150,
            ]
        );

        $resolved = $this->getResolvedSelectors();

        Media::addJsDef([
            'internautenInfinityScrollConfig' => [
                'batchSize' => (int) Configuration::get(self::CONF_BATCH_SIZE, 20),
                'productListSelectors' => $resolved['productListSelectors'],
                'productItemSelector' => $resolved['productItemSelector'],
                'nextLinkSelectors' => $resolved['nextLinkSelectors'],
                'paginationSelectors' => $resolved['paginationSelectors'],
                'loadingText' => $this->l('Loading more products...'),
                'errorText' => $this->l('Could not load more products.'),
                'debug' => (bool) Configuration::get(self::CONF_DEBUG_LOGS, false),
            ],
        ]);
    }

    private function installConfiguration()
    {
        $defaults = $this->getThemeSelectorProfiles();
        $generic = $defaults['generic'];

        return Configuration::updateValue(self::CONF_BATCH_SIZE, 20)
            && Configuration::updateValue(self::CONF_THEME_PROFILE, 'auto')
            && Configuration::updateValue(
                self::CONF_PRODUCT_LIST_SELECTORS,
                implode("\n", $generic['productListSelectors'])
            )
            && Configuration::updateValue(self::CONF_PRODUCT_ITEM_SELECTOR, $generic['productItemSelector'])
            && Configuration::updateValue(
                self::CONF_NEXT_LINK_SELECTORS,
                implode("\n", $generic['nextLinkSelectors'])
            )
            && Configuration::updateValue(
                self::CONF_PAGINATION_SELECTORS,
                implode("\n", $generic['paginationSelectors'])
            )
            && Configuration::updateValue(self::CONF_DEBUG_LOGS, 0);
    }

    private function uninstallConfiguration()
    {
        return Configuration::deleteByName(self::CONF_BATCH_SIZE)
            && Configuration::deleteByName(self::CONF_THEME_PROFILE)
            && Configuration::deleteByName(self::CONF_PRODUCT_LIST_SELECTORS)
            && Configuration::deleteByName(self::CONF_PRODUCT_ITEM_SELECTOR)
            && Configuration::deleteByName(self::CONF_NEXT_LINK_SELECTORS)
            && Configuration::deleteByName(self::CONF_PAGINATION_SELECTORS)
            && Configuration::deleteByName(self::CONF_DEBUG_LOGS);
    }

    private function renderForm()
    {
        $profiles = [];
        foreach (array_keys($this->getThemeSelectorProfiles()) as $key) {
            $profiles[] = [
                'id_option' => $key,
                'name' => ucfirst($key),
            ];
        }

        $form = [
            'form' => [
                'legend' => [
                    'title' => $this->l('Infinity Scroll Settings'),
                ],
                'input' => [
                    [
                        'type' => 'text',
                        'label' => $this->l('Products per request'),
                        'name' => self::CONF_BATCH_SIZE,
                        'class' => 'fixed-width-sm',
                        'desc' => $this->l('How many products should be loaded per request. Recommended: 20.'),
                    ],
                    [
                        'type' => 'select',
                        'label' => $this->l('Theme profile'),
                        'name' => self::CONF_THEME_PROFILE,
                        'options' => [
                            'query' => $profiles,
                            'id' => 'id_option',
                            'name' => 'name',
                        ],
                        'desc' => $this->l('Select AUTO to detect the active theme. Custom selectors below override profile defaults.'),
                    ],
                    [
                        'type' => 'textarea',
                        'label' => $this->l('Product list selectors'),
                        'name' => self::CONF_PRODUCT_LIST_SELECTORS,
                        'cols' => 70,
                        'rows' => 5,
                        'desc' => $this->l('One CSS selector per line. Leave empty to use only theme profile defaults.'),
                    ],
                    [
                        'type' => 'text',
                        'label' => $this->l('Product item selector'),
                        'name' => self::CONF_PRODUCT_ITEM_SELECTOR,
                        'desc' => $this->l('Selector for one product card. You can use comma-separated selectors.'),
                    ],
                    [
                        'type' => 'textarea',
                        'label' => $this->l('Next page link selectors'),
                        'name' => self::CONF_NEXT_LINK_SELECTORS,
                        'cols' => 70,
                        'rows' => 4,
                        'desc' => $this->l('One CSS selector per line to locate the next-page link.'),
                    ],
                    [
                        'type' => 'textarea',
                        'label' => $this->l('Pagination container selectors'),
                        'name' => self::CONF_PAGINATION_SELECTORS,
                        'cols' => 70,
                        'rows' => 4,
                        'desc' => $this->l('One CSS selector per line for pagination containers to hide.'),
                    ],
                    [
                        'type' => 'switch',
                        'label' => $this->l('Enable debug logs'),
                        'name' => self::CONF_DEBUG_LOGS,
                        'is_bool' => true,
                        'values' => [
                            [
                                'id' => self::CONF_DEBUG_LOGS . '_on',
                                'value' => 1,
                                'label' => $this->l('Yes'),
                            ],
                            [
                                'id' => self::CONF_DEBUG_LOGS . '_off',
                                'value' => 0,
                                'label' => $this->l('No'),
                            ],
                        ],
                        'desc' => $this->l('Logs load/stop decisions to the browser console for troubleshooting.'),
                    ],
                ],
                'submit' => [
                    'title' => $this->l('Save'),
                ],
            ],
        ];

        $helper = new HelperForm();
        $helper->module = $this;
        $helper->name_controller = $this->name;
        $helper->token = Tools::getAdminTokenLite('AdminModules');
        $helper->currentIndex = AdminController::$currentIndex . '&configure=' . $this->name;
        $helper->submit_action = 'submit' . $this->name;
        $helper->default_form_language = (int) Configuration::get('PS_LANG_DEFAULT');
        $helper->allow_employee_form_lang = (int) Configuration::get('PS_BO_ALLOW_EMPLOYEE_FORM_LANG');
        $helper->fields_value = [
            self::CONF_BATCH_SIZE => (int) Configuration::get(self::CONF_BATCH_SIZE, 20),
            self::CONF_THEME_PROFILE => (string) Configuration::get(self::CONF_THEME_PROFILE, 'auto'),
            self::CONF_PRODUCT_LIST_SELECTORS => (string) Configuration::get(self::CONF_PRODUCT_LIST_SELECTORS, ''),
            self::CONF_PRODUCT_ITEM_SELECTOR => (string) Configuration::get(self::CONF_PRODUCT_ITEM_SELECTOR, ''),
            self::CONF_NEXT_LINK_SELECTORS => (string) Configuration::get(self::CONF_NEXT_LINK_SELECTORS, ''),
            self::CONF_PAGINATION_SELECTORS => (string) Configuration::get(self::CONF_PAGINATION_SELECTORS, ''),
            self::CONF_DEBUG_LOGS => (int) Configuration::get(self::CONF_DEBUG_LOGS, 0),
        ];

        return $helper->generateForm([$form]);
    }

    private function sanitizeSelectorMultiline($value)
    {
        $lines = preg_split('/\r\n|\r|\n/', $value);
        $sanitized = [];
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line !== '') {
                $sanitized[] = $line;
            }
        }

        return implode("\n", $sanitized);
    }

    private function multilineConfigToArray($value)
    {
        $lines = preg_split('/\r\n|\r|\n/', (string) $value);
        $result = [];
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line !== '') {
                $result[] = $line;
            }
        }

        return $result;
    }

    private function uniqueMergedSelectors(array $defaults, array $custom)
    {
        $merged = array_merge($custom, $defaults);
        $clean = [];
        foreach ($merged as $selector) {
            $selector = trim((string) $selector);
            if ($selector !== '' && !in_array($selector, $clean, true)) {
                $clean[] = $selector;
            }
        }

        return $clean;
    }

    private function getResolvedSelectors()
    {
        $profiles = $this->getThemeSelectorProfiles();
        $profileKey = (string) Configuration::get(self::CONF_THEME_PROFILE, 'auto');
        if ($profileKey === 'auto') {
            $profileKey = $this->detectThemeProfile();
        }

        if (!isset($profiles[$profileKey])) {
            $profileKey = 'generic';
        }

        $defaults = $profiles[$profileKey];

        $customProductList = $this->multilineConfigToArray(
            Configuration::get(self::CONF_PRODUCT_LIST_SELECTORS, '')
        );
        $customNext = $this->multilineConfigToArray(
            Configuration::get(self::CONF_NEXT_LINK_SELECTORS, '')
        );
        $customPagination = $this->multilineConfigToArray(
            Configuration::get(self::CONF_PAGINATION_SELECTORS, '')
        );
        $customItem = trim((string) Configuration::get(self::CONF_PRODUCT_ITEM_SELECTOR, ''));

        return [
            'productListSelectors' => $this->uniqueMergedSelectors($defaults['productListSelectors'], $customProductList),
            'productItemSelector' => $customItem !== '' ? $customItem : $defaults['productItemSelector'],
            'nextLinkSelectors' => $this->uniqueMergedSelectors($defaults['nextLinkSelectors'], $customNext),
            'paginationSelectors' => $this->uniqueMergedSelectors($defaults['paginationSelectors'], $customPagination),
        ];
    }

    private function detectThemeProfile()
    {
        $themeName = '';
        if (defined('_THEME_NAME_')) {
            $themeName = strtolower((string) _THEME_NAME_);
        }

        if (strpos($themeName, 'classic') !== false) {
            return 'classic';
        }

        if (strpos($themeName, 'hummingbird') !== false) {
            return 'hummingbird';
        }

        if (strpos($themeName, 'warehouse') !== false) {
            return 'warehouse';
        }

        return 'generic';
    }

    private function getThemeSelectorProfiles()
    {
        return [
            'auto' => [
                'productListSelectors' => [
                    '#js-product-list .products',
                    '.products',
                ],
                'productItemSelector' => '.js-product-miniature',
                'nextLinkSelectors' => [
                    '.pagination .next a',
                    '.pagination-next a',
                    'a[rel="next"]',
                ],
                'paginationSelectors' => [
                    '.pagination',
                    '.js-product-list-top .pagination',
                    '.js-product-list-bottom .pagination',
                ],
            ],
            'generic' => [
                'productListSelectors' => [
                    '#js-product-list .products',
                    '.products',
                ],
                'productItemSelector' => '.js-product-miniature',
                'nextLinkSelectors' => [
                    '.pagination .next a',
                    '.pagination-next a',
                    'a[rel="next"]',
                ],
                'paginationSelectors' => [
                    '.pagination',
                    '.js-product-list-top .pagination',
                    '.js-product-list-bottom .pagination',
                ],
            ],
            'classic' => [
                'productListSelectors' => [
                    '#js-product-list .products',
                    '.products.row',
                    '.products',
                ],
                'productItemSelector' => '.js-product-miniature',
                'nextLinkSelectors' => [
                    '.pagination .next a',
                    '.pagination-next a',
                    'a[rel="next"]',
                ],
                'paginationSelectors' => [
                    '.pagination',
                    '.products-selection .pagination',
                ],
            ],
            'hummingbird' => [
                'productListSelectors' => [
                    '#products .products-grid',
                    '#js-product-list .products',
                    '.products',
                ],
                'productItemSelector' => '.js-product-miniature',
                'nextLinkSelectors' => [
                    '.pagination .next a',
                    '.pagination-next a',
                    'a[rel="next"]',
                ],
                'paginationSelectors' => [
                    '.pagination',
                    '.products-footer .pagination',
                ],
            ],
            'warehouse' => [
                'productListSelectors' => [
                    '#js-product-list .products',
                    '.product_list',
                    '.products',
                ],
                'productItemSelector' => '.js-product-miniature, .ajax_block_product',
                'nextLinkSelectors' => [
                    '.pagination .next a',
                    '.pagination-next a',
                    'a[rel="next"]',
                ],
                'paginationSelectors' => [
                    '.pagination',
                    '.products-selection .pagination',
                ],
            ],
        ];
    }

    private function isProductListingPage()
    {
        if (!isset($this->context->controller) || !is_object($this->context->controller)) {
            return false;
        }

        $phpSelf = (string) $this->context->controller->php_self;
        $listingPages = [
            'category',
            'search',
            'new-products',
            'prices-drop',
            'best-sales',
            'manufacturer',
            'supplier',
        ];

        return in_array($phpSelf, $listingPages, true);
    }
}
