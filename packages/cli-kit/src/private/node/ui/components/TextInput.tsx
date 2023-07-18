/* eslint-disable no-nested-ternary */
import {shouldDisplayColors} from '../../../../public/node/output.js'
import React, {useEffect, useState} from 'react'
import {Text, useInput} from 'ink'
import chalk from 'chalk'
import figures from 'figures'
import type {FunctionComponent} from 'react'

interface TextInputProps {
  defaultValue?: string
  value: string
  onChange: (value: string) => void
  color?: string
  password?: boolean
  focus?: boolean
  placeholder?: string
}

const TextInput: FunctionComponent<TextInputProps> = ({
  value: originalValue,
  defaultValue = '',
  onChange,
  placeholder = '',
  color = 'cyan',
  password = false,
  focus = true,
}) => {
  const [cursorOffset, setCursorOffset] = useState((originalValue || '').length)

  // if the updated value is shorter than the last one we need to reset the cursor
  useEffect(() => {
    setCursorOffset((previousOffset) => {
      const newValue = originalValue || ''

      if (previousOffset > newValue.length - 1) {
        return newValue.length
      }

      return previousOffset
    })
  }, [originalValue])

  const value = password ? '*'.repeat(originalValue.length) : originalValue
  let renderedValue

  const renderPlaceholder = (value: string) => {
    return chalk.inverse(value[0]) + chalk.dim(value.slice(1))
  }

  const cursorChar = figures.square
  const defaultCursor = (
    <Text color={color} backgroundColor={color}>
      {cursorChar}
    </Text>
  )

  const renderedPlaceholder =
    defaultValue.length > 0
      ? renderPlaceholder(defaultValue)
      : placeholder.length > 0
      ? renderPlaceholder(placeholder)
      : defaultCursor

  // render cursor
  renderedValue = value
    .split('')
    .map((char, index) => {
      if (index === cursorOffset) {
        return shouldDisplayColors() ? chalk.inverse(char) : cursorChar
      } else {
        return char
      }
    })
    .join('')

  if (cursorOffset === value.length) {
    renderedValue = (
      <Text>
        {renderedValue}
        {defaultCursor}
      </Text>
    )
  }

  useInput(
    (input, key) => {
      if (
        key.upArrow ||
        key.downArrow ||
        (key.ctrl && input === 'c') ||
        key.tab ||
        (key.shift && key.tab) ||
        key.return
      ) {
        return
      }

      let nextCursorOffset = cursorOffset
      let nextValue = originalValue

      if (key.leftArrow) {
        if (cursorOffset > 0) {
          nextCursorOffset--
        }
      } else if (key.rightArrow) {
        if (cursorOffset < originalValue.length) {
          nextCursorOffset++
        }
      } else if (key.backspace || key.delete) {
        if (cursorOffset > 0) {
          nextValue = originalValue.slice(0, cursorOffset - 1) + originalValue.slice(cursorOffset, originalValue.length)
          nextCursorOffset--
        }
      } else {
        nextValue =
          originalValue.slice(0, cursorOffset) + input + originalValue.slice(cursorOffset, originalValue.length)
        nextCursorOffset += input.length
      }

      setCursorOffset(nextCursorOffset)

      if (nextValue !== originalValue) {
        onChange(nextValue)
      }
    },
    {isActive: focus},
  )

  return <Text color={color}>{value.length > 0 ? renderedValue : renderedPlaceholder}</Text>
}

export {TextInput}
