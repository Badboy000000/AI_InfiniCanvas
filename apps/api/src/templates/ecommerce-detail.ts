import type { Workflow } from '@ai-canvas/workflow-core';

/**
 * 电商详情图 MVP 工作流模板（第一版）。
 *
 * 使用通用节点组合：
 * - input.text：商品资料
 * - input.image：商品图 + 参考图
 * - ai.image_analysis：商品图分析
 * - processor.context_assembler：把商品资料 + 图片分析合并为详情图上下文
 * - ai.image_generation：生成主视觉详情图
 * - processor.image_stitch：拼接长图（第一版只有一张，作为占位链路）
 * - export.image：导出资产
 *
 * 参数完全对齐 [[节点协议设计]] 中每个 NodeDefinition 的 input/output key。
 * 该模板可以作为 [[电商详情图工作流示例 JSON]] 的可运行 MVP 版本，
 * 但节点类型全部来自 packages/node-definitions，避免电商专属节点污染协议。
 */
export function createEcommerceDetailWorkflow(id: string): Workflow {
  return {
    id,
    name: '电商详情图 MVP',
    description: '用通用节点组合验证电商详情图生成 → 拼接 → 导出闭环。',
    nodes: [
      {
        id: 'product_text',
        type: 'input.text',
        title: '商品资料',
        position: { x: 60, y: 80 },
        config: {
          params: {
            value: '商品：轻盈感春季连衣裙\n卖点：透气 / 显瘦剪裁 / 温柔莫兰迪色\n受众：都市女性 25-32',
          },
        },
      },
      {
        id: 'product_images',
        type: 'input.image',
        title: '商品图与参考图',
        position: { x: 60, y: 260 },
        config: {
          params: {
            allowMultiple: true,
            assetIds: ['demo-product-1', 'demo-reference-1'],
          },
        },
      },
      {
        id: 'image_analysis',
        type: 'ai.image_analysis',
        title: '图片分析',
        position: { x: 420, y: 260 },
        config: { params: { task: 'product_image_analysis' } },
      },
      {
        id: 'context_assembler',
        type: 'processor.context_assembler',
        title: '详情图上下文',
        position: { x: 780, y: 160 },
        config: {
          params: {
            template: '# 商品资料\n{{primary}}\n\n# 图片洞察\n{{extras}}',
          },
        },
      },
      {
        id: 'image_generation',
        type: 'ai.image_generation',
        title: '主视觉详情图',
        position: { x: 1120, y: 160 },
        config: {
          params: {
            preset: 'ecommerce_detail_screen_image_v1',
            size: '750x1000',
            quality: 'balanced',
          },
        },
      },
      {
        id: 'image_stitch',
        type: 'processor.image_stitch',
        title: '详情长图',
        position: { x: 1480, y: 160 },
        config: {
          params: {
            direction: 'vertical',
            gap: 0,
          },
        },
      },
      {
        id: 'export_image',
        type: 'export.image',
        title: '导出资产',
        position: { x: 1840, y: 160 },
        config: {
          params: {
            format: 'jpg',
            quality: 92,
          },
        },
      },
    ],
    edges: [
      {
        id: 'e_text_ctx',
        sourceNodeId: 'product_text',
        sourceOutputKey: 'text',
        targetNodeId: 'context_assembler',
        targetInputKey: 'primary',
      },
      {
        id: 'e_images_analysis',
        sourceNodeId: 'product_images',
        sourceOutputKey: 'images',
        targetNodeId: 'image_analysis',
        targetInputKey: 'images',
      },
      {
        id: 'e_text_analysis_ctx',
        sourceNodeId: 'product_text',
        sourceOutputKey: 'text',
        targetNodeId: 'image_analysis',
        targetInputKey: 'context',
      },
      {
        id: 'e_analysis_ctx',
        sourceNodeId: 'image_analysis',
        sourceOutputKey: 'analysis',
        targetNodeId: 'context_assembler',
        targetInputKey: 'extras',
      },
      {
        id: 'e_ctx_gen',
        sourceNodeId: 'context_assembler',
        sourceOutputKey: 'context',
        targetNodeId: 'image_generation',
        targetInputKey: 'generationContext',
      },
      {
        id: 'e_images_ref',
        sourceNodeId: 'product_images',
        sourceOutputKey: 'images',
        targetNodeId: 'image_generation',
        targetInputKey: 'referenceImages',
      },
      {
        id: 'e_gen_stitch',
        sourceNodeId: 'image_generation',
        sourceOutputKey: 'generatedImage',
        targetNodeId: 'image_stitch',
        targetInputKey: 'images',
      },
      {
        id: 'e_stitch_export',
        sourceNodeId: 'image_stitch',
        sourceOutputKey: 'stitchedImage',
        targetNodeId: 'export_image',
        targetInputKey: 'image',
      },
    ],
  };
}
