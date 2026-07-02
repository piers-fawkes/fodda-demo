import re

content_file = 'frontend/components/AccountPortal.tsx'
with open(content_file, 'r') as f:
    content = f.read()

# Filter out comments/strings that might have tags if possible, but let's start simple
# This regex is very crude and might be fooled by <div in strings
tags = re.findall(r'<div|</div', content)
stack = []
for i, tag in enumerate(tags):
    if tag == '<div':
        stack.append(i)
    else:
        if stack:
            stack.pop()
        else:
            print(f"Unexpected </div at tag index {i}")

print(f"Stack size at end: {len(stack)}")
