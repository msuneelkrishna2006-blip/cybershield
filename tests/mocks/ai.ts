export const generateText = jest.fn().mockResolvedValue({
  text: JSON.stringify({
    riskLevel: 'low',
    riskContext: 'Mock test context',
    adjustedInterval: 15,
  }),
})
