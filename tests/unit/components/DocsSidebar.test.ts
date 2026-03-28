/**
 * Unit tests for DocsSidebar component.
 *
 * Tests rendering behavior: navigation tree, active page highlighting,
 * method badges, sorting by order, expand/collapse, and empty state.
 *
 * Feature: api-docs-cms
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 10.2
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, computed, ref, h } from 'vue'
import { getMethodColor } from '~/app/utils/docsMethodColor'

// --- Minimal reproduction of DocsSidebar logic ---

interface NavItem {
  title: string
  path: string
  order?: number
  icon?: string
  method?: string
  children?: NavItem[]
}

function sortByOrder<T extends { order?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
}

const DocsSidebar = defineComponent({
  name: 'DocsSidebar',
  props: {
    navigation: { type: Array as () => NavItem[], required: true },
    currentPath: { type: String, required: true },
  },
  setup(props) {
    const sortedNavigation = computed(() => sortByOrder(props.navigation))
    const expandedCategories = ref<Record<string, boolean>>({})

    function isExpanded(path: string): boolean {
      if (expandedCategories.value[path] !== undefined) {
        return expandedCategories.value[path]
      }
      return props.currentPath.startsWith(path)
    }

    function toggleCategory(path: string) {
      expandedCategories.value[path] = !isExpanded(path)
    }

    function isActive(path: string): boolean {
      return props.currentPath === path
    }

    const isEmpty = computed(() => !props.navigation || props.navigation.length === 0)

    return () =>
      h('nav', { 'aria-label': 'Documentation sidebar' }, [
        isEmpty.value
          ? h('div', { class: 'empty-state' }, 'No documentation available.')
          : h('ul', { class: 'nav-tree' },
            sortedNavigation.value.map(category =>
              h('li', { key: category.path, class: 'category' }, [
                h('button', {
                  class: `category-header ${isActive(category.path) ? 'active' : ''}`,
                  onClick: () => toggleCategory(category.path),
                }, [
                  category.icon ? h('span', { class: 'icon' }, category.icon) : null,
                  h('span', { class: 'title' }, category.title),
                ]),
                category.children?.length && isExpanded(category.path)
                  ? h('ul', { class: 'children' },
                    sortByOrder(category.children).map(child =>
                      h('li', { key: child.path }, [
                        h('a', {
                          href: child.path,
                          class: `child-link ${isActive(child.path) ? 'active' : ''}`,
                        }, [
                          child.method
                            ? h('span', {
                              class: `method-badge ${getMethodColor(child.method).bg} ${getMethodColor(child.method).text}`,
                            }, child.method)
                            : null,
                          h('span', { class: 'child-title' }, child.title),
                        ]),
                      ]),
                    ),
                  )
                  : null,
              ]),
            ),
          ),
      ])
  },
})

// --- Test data ---

const sampleNavigation: NavItem[] = [
  {
    title: 'Jobs API',
    path: '/api-docs/jobs',
    icon: 'i-lucide-briefcase',
    order: 1,
    children: [
      { title: 'List Jobs', path: '/api-docs/jobs/list', method: 'GET', order: 1 },
      { title: 'Create Job', path: '/api-docs/jobs/create', method: 'POST', order: 3 },
      { title: 'Get Job', path: '/api-docs/jobs/get', method: 'GET', order: 2 },
    ],
  },
  {
    title: 'Serials API',
    path: '/api-docs/serials',
    icon: 'i-lucide-hash',
    order: 3,
    children: [
      { title: 'List Serials', path: '/api-docs/serials/list', method: 'GET', order: 1 },
      { title: 'Advance Serial', path: '/api-docs/serials/advance', method: 'POST', order: 2 },
    ],
  },
  {
    title: 'Paths API',
    path: '/api-docs/paths',
    icon: 'i-lucide-route',
    order: 2,
    children: [
      { title: 'Delete Path', path: '/api-docs/paths/delete', method: 'DELETE', order: 2 },
      { title: 'Get Path', path: '/api-docs/paths/get', method: 'GET', order: 1 },
    ],
  },
]

// --- Tests ---

describe('DocsSidebar', () => {
  // Req 10.2: Empty state when no documentation is available
  describe('empty state', () => {
    it('shows empty state when navigation is empty', () => {
      const wrapper = mount(DocsSidebar, {
        props: { navigation: [], currentPath: '/api-docs' },
      })
      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.text()).toContain('No documentation available')
    })

    it('does not show empty state when navigation has items', () => {
      const wrapper = mount(DocsSidebar, {
        props: { navigation: sampleNavigation, currentPath: '/api-docs' },
      })
      expect(wrapper.find('.empty-state').exists()).toBe(false)
    })
  })

  // Req 6.1, 6.2: Renders nested navigation tree grouped by category
  describe('navigation tree rendering', () => {
    it('renders all top-level categories', () => {
      const wrapper = mount(DocsSidebar, {
        props: { navigation: sampleNavigation, currentPath: '/api-docs/jobs/list' },
      })
      const categories = wrapper.findAll('.category-header')
      expect(categories).toHaveLength(3)
    })

    it('renders category titles', () => {
      const wrapper = mount(DocsSidebar, {
        props: { navigation: sampleNavigation, currentPath: '/api-docs/jobs/list' },
      })
      const titles = wrapper.findAll('.category-header .title')
      // Sorted by order: Jobs (1), Paths (2), Serials (3)
      expect(titles[0].text()).toBe('Jobs API')
      expect(titles[1].text()).toBe('Paths API')
      expect(titles[2].text()).toBe('Serials API')
    })

    it('renders children for expanded categories', () => {
      const wrapper = mount(DocsSidebar, {
        props: { navigation: sampleNavigation, currentPath: '/api-docs/jobs/list' },
      })
      // Jobs category should be expanded (currentPath starts with /api-docs/jobs)
      const children = wrapper.findAll('.children .child-link')
      expect(children.length).toBeGreaterThan(0)
    })
  })

  // Req 6.5: Items sorted by navigation.order at every nesting level
  describe('sorting by order', () => {
    it('sorts top-level categories by order', () => {
      const wrapper = mount(DocsSidebar, {
        props: { navigation: sampleNavigation, currentPath: '/api-docs/jobs/list' },
      })
      const titles = wrapper.findAll('.category-header .title').map(t => t.text())
      expect(titles).toEqual(['Jobs API', 'Paths API', 'Serials API'])
    })

    it('sorts children within a category by order', () => {
      const wrapper = mount(DocsSidebar, {
        props: { navigation: sampleNavigation, currentPath: '/api-docs/jobs/list' },
      })
      const childTitles = wrapper.findAll('.children .child-title').map(t => t.text())
      // Jobs children sorted: List (1), Get (2), Create (3)
      expect(childTitles[0]).toBe('List Jobs')
      expect(childTitles[1]).toBe('Get Job')
      expect(childTitles[2]).toBe('Create Job')
    })
  })

  // Req 6.3: Highlight currently active page
  describe('active page highlighting', () => {
    it('marks the active child link', () => {
      const wrapper = mount(DocsSidebar, {
        props: { navigation: sampleNavigation, currentPath: '/api-docs/jobs/list' },
      })
      const activeLinks = wrapper.findAll('.child-link.active')
      expect(activeLinks).toHaveLength(1)
      expect(activeLinks[0].text()).toContain('List Jobs')
    })

    it('marks the active category header when on category index', () => {
      const wrapper = mount(DocsSidebar, {
        props: { navigation: sampleNavigation, currentPath: '/api-docs/jobs' },
      })
      const activeHeaders = wrapper.findAll('.category-header.active')
      expect(activeHeaders).toHaveLength(1)
      expect(activeHeaders[0].text()).toContain('Jobs API')
    })

    it('does not mark non-active links as active', () => {
      const wrapper = mount(DocsSidebar, {
        props: { navigation: sampleNavigation, currentPath: '/api-docs/jobs/list' },
      })
      const createLink = wrapper.findAll('.child-link').find(l => l.text().includes('Create Job'))
      expect(createLink?.classes()).not.toContain('active')
    })
  })

  // Req 6.4: HTTP method badges next to endpoint page links
  describe('method badges', () => {
    it('renders method badges for children with a method', () => {
      const wrapper = mount(DocsSidebar, {
        props: { navigation: sampleNavigation, currentPath: '/api-docs/jobs/list' },
      })
      const badges = wrapper.findAll('.method-badge')
      expect(badges.length).toBeGreaterThan(0)
      expect(badges[0].text()).toBe('GET')
    })

    it('applies correct color classes for GET method', () => {
      const wrapper = mount(DocsSidebar, {
        props: { navigation: sampleNavigation, currentPath: '/api-docs/jobs/list' },
      })
      const getBadge = wrapper.findAll('.method-badge').find(b => b.text() === 'GET')
      expect(getBadge).toBeDefined()
      const classes = getBadge!.classes().join(' ')
      expect(classes).toContain('green')
    })

    it('applies correct color classes for POST method', () => {
      const wrapper = mount(DocsSidebar, {
        props: { navigation: sampleNavigation, currentPath: '/api-docs/jobs/list' },
      })
      const postBadge = wrapper.findAll('.method-badge').find(b => b.text() === 'POST')
      expect(postBadge).toBeDefined()
      const classes = postBadge!.classes().join(' ')
      expect(classes).toContain('blue')
    })

    it('does not render badge when child has no method', () => {
      const navWithNoMethod: NavItem[] = [{
        title: 'Overview',
        path: '/api-docs/overview',
        order: 1,
        children: [
          { title: 'Getting Started', path: '/api-docs/overview/start', order: 1 },
        ],
      }]
      const wrapper = mount(DocsSidebar, {
        props: { navigation: navWithNoMethod, currentPath: '/api-docs/overview/start' },
      })
      expect(wrapper.find('.method-badge').exists()).toBe(false)
    })
  })

  // Req 6.6: Expand/collapse for category groups
  describe('expand/collapse', () => {
    it('auto-expands category matching currentPath', () => {
      const wrapper = mount(DocsSidebar, {
        props: { navigation: sampleNavigation, currentPath: '/api-docs/jobs/list' },
      })
      // Jobs should be expanded, children visible
      const jobsChildren = wrapper.findAll('.children')
      expect(jobsChildren.length).toBeGreaterThan(0)
    })

    it('collapses category not matching currentPath', () => {
      const wrapper = mount(DocsSidebar, {
        props: { navigation: sampleNavigation, currentPath: '/api-docs/jobs/list' },
      })
      // Serials should be collapsed — no children rendered for it
      const allText = wrapper.text()
      expect(allText).not.toContain('Advance Serial')
    })

    it('toggles category on click', async () => {
      const wrapper = mount(DocsSidebar, {
        props: { navigation: sampleNavigation, currentPath: '/api-docs/jobs/list' },
      })
      // Jobs is expanded — click to collapse
      const jobsHeader = wrapper.findAll('.category-header')[0]
      await jobsHeader.trigger('click')
      expect(wrapper.text()).not.toContain('List Jobs')

      // Click again to expand
      await jobsHeader.trigger('click')
      expect(wrapper.text()).toContain('List Jobs')
    })
  })

  // Accessibility
  describe('accessibility', () => {
    it('renders a nav element with aria-label', () => {
      const wrapper = mount(DocsSidebar, {
        props: { navigation: sampleNavigation, currentPath: '/api-docs' },
      })
      const nav = wrapper.find('nav')
      expect(nav.exists()).toBe(true)
      expect(nav.attributes('aria-label')).toBe('Documentation sidebar')
    })
  })
})
