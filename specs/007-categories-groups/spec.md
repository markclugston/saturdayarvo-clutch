# Feature Specification: Categories and Groups Screen

**Feature Branch**: `007-categories-groups`

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "create a new screen at the same level as accounts. in this screen you will be able to create categories and groups where groups contain many categories. when you create a category you need to specify either a group or another category as its parent. groups will have a name and list of categories. categories will have the same properties. when you create either a group or category it will go to the bottom of the list. when displaying the list, groups should be in larger text than categories and have a gap between each grouping. there is no reordering."

## Clarifications

### Session 2026-11-10

- Q: Can siblings share a name? → A: No; duplicate names among siblings (groups with groups, categories under the same parent) are rejected, case-insensitively.
- Q: How is a parent chosen? → A: A single dropdown listing every group and category in display order, indented by level.
- Q: Is the screen create-only? → A: No; users can also rename and delete groups and categories.
- Q: What happens to children on delete? → A: The item and all its descendants are deleted after a warning and confirmation prompt.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and view groups (Priority: P1)

A user opens a new Categories screen, reachable from the same top-level navigation as Accounts, and creates a group by entering a name. The group appears at the bottom of the list.

**Why this priority**: Groups are the top-level containers; nothing else can exist without them.

**Independent Test**: Open the screen, create two groups, and confirm both appear in creation order with the newest at the bottom.

**Acceptance Scenarios**:

1. **Given** the screen has no groups, **When** the user creates a group named "Household", **Then** "Household" is listed.
2. **Given** a group "Household" exists, **When** the user creates a group "Income", **Then** "Income" appears below "Household".
3. **Given** the user submits a group with an empty name, **Then** the group is not created and the user sees a message that a name is required.

---

### User Story 2 - Create categories under a group or category (Priority: P1)

A user creates a category by entering a name and choosing a parent, which must be either a group or another category. The new category appears at the bottom of its parent's list of categories.

**Why this priority**: Categories are the purpose of the screen; they must be placed in the hierarchy.

**Independent Test**: With one group present, create a category under the group, then create a second category with the first category as its parent, and confirm both are placed correctly.

**Acceptance Scenarios**:

1. **Given** a group "Household" exists, **When** the user creates category "Groceries" with parent "Household", **Then** "Groceries" is listed under "Household".
2. **Given** category "Groceries" exists, **When** the user creates category "Fruit" with parent "Groceries", **Then** "Fruit" is listed under "Groceries".
3. **Given** "Groceries" already has a child, **When** the user creates another category under it, **Then** the new category appears below the existing child.
4. **Given** the user has not chosen a parent, **When** they try to create a category, **Then** it is not created and the user is told a parent is required.
5. **Given** no groups or categories exist, **When** the user starts to create a category, **Then** the user is told a group must be created first.

---

### User Story 3 - Read the hierarchy clearly (Priority: P2)

The list shows groups in larger text than categories, with a visible gap between each group and the next, so each group with its categories reads as a distinct block. Nested categories are shown indented beneath their parent.

**Why this priority**: Clear presentation makes the hierarchy usable, but it builds on creation.

**Independent Test**: Create two groups, each with categories, and verify group text is larger, categories are smaller and indented, and a gap separates the groupings.

**Acceptance Scenarios**:

1. **Given** multiple groups with categories, **When** the list is displayed, **Then** group names use larger text than category names.
2. **Given** two or more groups, **When** the list is displayed, **Then** there is a visible gap between one group's block and the next.
3. **Given** a category nested under another category, **When** the list is displayed, **Then** it appears beneath its parent and indented further than its parent.

---

### User Story 4 - Rename and delete (Priority: P3)

A user can rename any group or category, and delete any group or category. Deleting warns that the item and everything beneath it will be removed and asks whether to continue.

**Why this priority**: Corrects mistakes, but is not needed to build the hierarchy.

**Independent Test**: Rename an item, then delete a group that has nested categories, first cancelling and then confirming.

**Acceptance Scenarios**:

1. **Given** category "Groceries" exists, **When** the user renames it to "Food", **Then** it keeps its position and parent with the new name.
2. **Given** a sibling named "Food" exists, **When** the user renames another sibling to "food", **Then** the rename is refused as a duplicate.
3. **Given** group "Household" has nested categories, **When** the user chooses delete, **Then** a warning states that the item and all categories beneath it will be deleted, shows how many items will be removed, and asks whether to continue.
4. **Given** the warning is shown, **When** the user cancels, **Then** nothing is deleted.
5. **Given** the warning is shown, **When** the user confirms, **Then** the group and all its descendants are removed.

---

### Edge Cases

- Duplicate names: the same name is allowed under different parents, but not among siblings.
- Names with only whitespace are treated as empty.
- Names over 100 characters are rejected with an explanation; names within the limit wrap without breaking the layout.
- The list is empty: the screen shows an empty state that invites the user to create a group.
- Creation fails (for example, a connection problem): the user sees an error and the list is unchanged.
- Cancelling the delete confirmation leaves everything unchanged.
- Deleting the last remaining group returns the screen to the empty state.
- Reordering is not offered; the order is fixed by creation order.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a Categories screen reachable from the same navigation level as the Accounts screen.
- **FR-002**: Users MUST be able to create a group by providing a name and choosing no parent in the same create form; when no groups exist, this is the only available choice.
- **FR-003**: Users MUST be able to create a category by providing a name and choosing a parent from a single dropdown listing every group and category in display order, indented by level; the parent is either a group or an existing category.
- **FR-004**: The system MUST refuse to create or rename a group or category with an empty, whitespace-only, or longer than 100 characters name, and explain why.
- **FR-004a**: The system MUST refuse a name that matches (case-insensitively) a sibling's name, meaning another group, or another category under the same parent, and explain why.
- **FR-005**: The system MUST refuse to create a category without a parent and explain why.
- **FR-006**: Each group MUST hold an ordered list of the categories directly beneath it, and each category MUST hold an ordered list of the categories directly beneath it.
- **FR-007**: A newly created group MUST be placed at the bottom of the list of groups.
- **FR-008**: A newly created category MUST be placed at the bottom of its parent's list of categories.
- **FR-009**: The list MUST display each group's name in larger text than any category name.
- **FR-010**: The list MUST show a visible gap between each group (with all its descendant categories) and the next group.
- **FR-011**: Categories MUST be displayed beneath their parent, indented one level deeper than the parent.
- **FR-012**: The system MUST NOT offer any way to reorder groups or categories.
- **FR-013**: Created groups and categories MUST be kept between sessions, and their order MUST remain unchanged when the screen is reopened.
- **FR-014**: The screen MUST show an empty state when no groups exist.
- **FR-016**: Users MUST be able to rename any group or category; renaming MUST NOT change its position or parent.
- **FR-017**: Users MUST be able to delete any group or category. Before deleting, the system MUST warn the user that the item and all categories beneath it will be deleted (stating how many items will be removed) and ask whether to continue; deletion MUST only occur on confirmation.
- **FR-015**: Controls on the screen MUST follow the app's existing button-based navigation and interaction conventions.

- **FR-018**: The screen MUST support the app's existing Light, Dark, and System themes, using the user's saved theme selection and the app's existing default; this feature adds no new theme setting.
- **FR-019**: All controls MUST be operable by keyboard, have accessible names and labels, and meet WCAG 2.2 Level AA. The delete confirmation MUST be an accessible dialog that moves focus into it and returns focus when closed. Validation and error messages MUST be announced to assistive technology.

### Key Entities *(include if feature involves data)*

- **Group**: A top-level container with a name and an ordered list of categories. It has no parent.
- **Category**: An item with a name and an ordered list of child categories (the same properties as a group). It has exactly one parent, which is either a group or another category.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can create a group and a category beneath it in under 1 minute on their first attempt.
- **SC-002**: 100% of newly created groups and categories appear at the bottom of their respective lists.
- **SC-003**: 100% of attempts to create a category without a parent are rejected with an explanation.
- **SC-004**: In a list with at least two groups, a user can identify which groups and categories belong together at a glance, with group names visibly larger than category names and a visible gap between groupings.
- **SC-005**: After reopening the screen, 100% of previously created items appear in their original order and positions.

## Assumptions

- Moving items to a different parent is out of scope.
- Groups cannot be nested inside other groups or categories.
- Category nesting depth is not limited.
- Categories and groups are for the signed-in user, consistent with the single-user access model.
- The Categories screen is added to the existing navigation next to Accounts, following the button-based navigation convention.
- Items are not yet linked to transactions; that is out of scope here.
